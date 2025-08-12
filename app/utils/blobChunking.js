
export class BlobChunker {
    constructor(chunkSize = 1024 * 1024) { // 1MB por padrão
        this.chunkSize = chunkSize;
    }

    // Arquivo em chunks
    divideFileIntoChunks(file) {
        const chunks = [];
        const totalChunks = Math.ceil(file.size / this.chunkSize);
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.chunkSize;
            const end = Math.min(start + this.chunkSize, file.size);
            const chunk = file.slice(start, end);
            
            chunks.push({
                index: i,
                data: chunk,
                size: chunk.size
            });
        }
        
        return {
            chunks,
            totalChunks,
            fileName: file.name,
            fileSize: file.size
        };
    }

    // Upload de arquivo com chunks/ Vercel Blob
    async uploadFileWithChunks(file, onProgress = null, onError = null) {
        try {
            const { chunks, totalChunks, fileName, fileSize } = this.divideFileIntoChunks(file);
            
            let uploadedChunks = 0;
            const chunkUrls = [];
            
            // Upload de cada chunk individualmente
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                
                // Criar um nome único para cada chunk
                const chunkFileName = `${fileName}.chunk.${chunk.index}.${totalChunks}`;
                
                const formData = new FormData();
                formData.append('file', chunk.data, chunkFileName);

                const response = await fetch('/api/post/uploadBlobChunk', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Erro no upload do chunk ${i + 1}`);
                }

                const result = await response.json();
                chunkUrls.push({
                    index: chunk.index,
                    url: result.url,
                    pathname: result.pathname
                });
                
                uploadedChunks++;
                
                // Callback de progresso
                if (onProgress) {
                    onProgress({
                        uploadedChunks,
                        totalChunks,
                        percentage: Math.round((uploadedChunks / totalChunks) * 100),
                        completed: uploadedChunks === totalChunks
                    });
                }
            }

            // reconstituir o arquivo
            const reconstructResponse = await fetch('/api/post/reconstructBlobFile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fileName,
                    fileSize,
                    totalChunks,
                    chunkUrls: chunkUrls.sort((a, b) => a.index - b.index)
                }),
            });

            if (!reconstructResponse.ok) {
                const errorData = await reconstructResponse.json();
                throw new Error(errorData.message || 'Erro na reconstituição do arquivo');
            }

            const finalResult = await reconstructResponse.json();

            return {
                success: true,
                data: finalResult.data
            };

        } catch (error) {
            if (onError) {
                onError(error);
            }
            throw error;
        }
    }

   
    async uploadFileTraditional(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/post/uploadBlobSingle', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro no upload do arquivo');
        }

        return await response.json();
    }

    async uploadFile(file, useChunking = true, onProgress = null, onError = null) {
        // Usar chunking para arquivos maiores que 5MB
        const shouldUseChunking = useChunking && file.size > (5 * 1024 * 1024);
        
        if (shouldUseChunking) {
            return await this.uploadFileWithChunks(file, onProgress, onError);
        } else {
            return await this.uploadFileTraditional(file);
        }
    }
}

