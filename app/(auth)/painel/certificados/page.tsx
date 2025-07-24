'use client'
// pages/index.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import TelaLoading from '@/components/TelaLoading';
import { Award, Medal, FileBadge2, FileWarning, Loader2 } from 'lucide-react';
import './style.css';
//
//
export default function Home() {
    const route = useRouter()
    const [firstLoading, setFirstLoading] = useState(true)
    const [dataOrganizador, setDataOrganizador] = useState([])
    const [dataAtividades, setDataAtividades] = useState([])
    const [isLoadingDeleteOrSend, setIsLoadingDeleteOrSend] = useState(false)

    const baixarCertificadoAtividades = async (componentId) => {
        setIsLoadingDeleteOrSend(true)
        try {
            const response = await fetch(`/api/get/certificateUrl/${componentId}`, {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Erro ao fazer o download do arquivo');
            }

            const responseJson = await response.json()

            route.push(responseJson.message)
            //window.open(responseJson.message, "_blank");


        } catch (error) {
            //setIsModalError(error.message || "Ocorreu algum erro ao tentar baixar seu arquivo. Recarregue a página e tente novamente. Caso o erro persista, entre em contato com a equipe COEPS.")
            console.error('Erro ao baixar o arquivo:', error);
        }
        finally {
            //setIsModalError("Seu download foi realizado com sucesso!")
            setIsLoadingDeleteOrSend(false)
        }
    };

    useEffect(() => {
        // URLs das APIs
        const urls = [
            '/api/get/usuarioOrganizacao',
            '/api/get/usuarioAtividades',
        ];

        // Função que faz as requisições
        const fetchData = async () => {
            try {

                // Cria um array de Promises para cada URL
                const [result1, result2] = await Promise.all(
                    urls.map(url =>
                        fetch(url)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error(`Erro ao buscar dados de ${url}: ${response.statusText}`);
                                }
                                return response.json();
                            })
                    )
                );
                setDataOrganizador(result1.data)
                setDataAtividades(result2.data)
                const certificateIdsList = result2.data.map(item => item.activityId);
                console.log(certificateIdsList)

                const result3 = await fetch("/api/post/getNomesAtividades", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ certificateIdsList }),
                });

                const result3Json = await result3.json()

                /*
                // Aguarda todas as Promises usando Promise.all
                const results = await Promise.all(fetchPromises);

                // Armazena os resultados no estado
                setData(results);
                */
            } catch (err) {
                console.log(err.message)
            } finally {
                // Finaliza o carregamento
                setFirstLoading(false);
            }
        };

        fetchData();
    }, []);


    if (firstLoading || isLoadingDeleteOrSend) {
        return (
            <div className="certificados-main">
                <div className="certificados-status-section">
                    <div className="certificados-status-container glass-container">
                        <div className="certificados-loading-container">
                            <div className="certificados-loading-spinner">
                                <Loader2 className="spinner-icon" />
                            </div>
                            <h2 className="certificados-loading-text">CARREGANDO CERTIFICADOS</h2>
                            <div className="certificados-loading-dots">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
    //
    return (
        <div className="certificados-main">
            <div className="certificados-container">
                <div className="certificados-header">
                    <h1 className="certificados-title">Meus Certificados</h1>
                </div>
                <div className="certificados-intro glass-container">
                    <h2>O QUE TEMOS AQUI?</h2>
                    <p>
                        Aqui, você encontrará os certificados das atividades em que participou. Seja como organizador, palestrante ou ouvinte, todas as suas participações receberão certificações. Esses certificados estarão disponíveis neste espaço para que você possa baixá-los facilmente.
                            </p>
                        </div>
                <div className="certificados-section glass-container">
                    <h2 className="certificados-section-title"><FileBadge2 size={22} className="certificados-section-icon" /> CERTIFICADOS</h2>
                    <div className="certificados-cards">
                            {
                                !dataOrganizador.length && !dataAtividades.length ?
                                    (
                                    <div className="certificados-empty">
                                        <FileWarning size={38} className="certificados-empty-icon" />
                                        <h3>Você ainda não possui certificados disponíveis.</h3>
                                        <p>Seus certificados ainda não estão prontos. Mas não se preocupe! Estamos trabalhando para disponibilizá-los o quanto antes!<br/>
                                            <span className='certificados-empty-highlight'>Caso possua alguma dúvida, fique à vontade para entrar em contato com a equipe COEPS.</span>
                                            </p>
                                        </div>
                                ) : null
                            }
                            {
                                dataOrganizador.length ?
                                <div className="certificados-group">
                                    <div className="certificados-group-title"><Medal size={20} /> Organização</div>
                                    <div className="certificados-group-cards">
                                        {dataOrganizador.map((value) => (
                                            <div
                                                key={value._id}
                                                className={`certificados-card${value.isShow && value.isOk ? ' baixavel' : ''}`}
                                                style={{ borderTopColor: value.isShow && value.isOk ? '#541A2C' : '#1B305F' }}
                                            >
                                                <div className="certificados-card-header">
                                                    <Award size={18} className="certificados-card-icon" />
                                                    <span className="certificados-card-type">{value.type.toLocaleUpperCase()}</span>
                                            </div>
                                                <div className="certificados-card-content">
                                                    {value.isShow ?
                                                                                value.isOk ?
                                                            <button className="certificados-download-btn" onClick={() => baixarCertificadoAtividades(value._id)}>
                                                                Baixar certificado
                                                            </button>
                                                            : <span className="certificados-card-status">Seu certificado ainda não está pronto.</span>
                                                        : <span className="certificados-card-status">Ainda não disponível.</span>
                                                    }
                                                        </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                : null
                            }
                            {
                                dataAtividades.length ?
                                <div className="certificados-group">
                                    <div className="certificados-group-title"><FileBadge2 size={20} /> Atividades</div>
                                    <div className="certificados-group-cards">
                                        {dataAtividades.map((atividade) => (
                                            <div
                                                key={atividade._id}
                                                className={`certificados-card${atividade.isShow && atividade.isOk ? ' baixavel' : ''}`}
                                                style={{ borderTopColor: atividade.isShow && atividade.isOk ? '#541A2C' : '#1B305F' }}
                                            >
                                                <div className="certificados-card-header">
                                                    <Medal size={18} className="certificados-card-icon" />
                                                    <span className="certificados-card-type">{atividade['type']} - {atividade.eventName.toLocaleUpperCase()}</span>
                                            </div>
                                                <div className="certificados-card-content">
                                                    {atividade.isShow ?
                                                                                atividade.isOk ?
                                                            <button className="certificados-download-btn" onClick={() => baixarCertificadoAtividades(atividade._id)}>
                                                                Baixar certificado
                                                            </button>
                                                            : <span className="certificados-card-status">Seu certificado ainda não está pronto.</span>
                                                        : <span className="certificados-card-status">Ainda não disponível.</span>
                                                    }
                                                        </div>
                                            </div>
                                        ))}
                        </div>
                                </div>
                                : null
                        }
                    </div>
                </div>
            </div>
        </div>
    );

}
/*


*/
