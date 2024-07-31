'use client'
// components/ImageModal.js

import { useState } from 'react';
import Image from 'next/image';

const ImageModal = ({ src, alt }) => {
  const [modalAberto, setModalAberto] = useState(false);

  const abrirModal = () => {
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
  };

  return (
    <div>
      <div onClick={abrirModal} className="cursor-pointer">
        <Image
          src={src}
          alt={alt}
          width={500} // Ajuste o tamanho conforme necessário
          height={500} // Ajuste o tamanho conforme necessário
        />
      </div>
      {modalAberto && (
        <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center bg-gray-800 bg-opacity-75 z-50  ">
          <div className="bg-white m-2 p-2 lg:m-0 lg:p-4 max-w-lg max-h-full overflow-auto">
            <div className='bg-red-600 absolute p-2 py-1 cursor-pointer font-extrabold' onClick={()=>{fecharModal()}}>
              <h1>X</h1>
            </div>
            <Image
              src={src}
              alt={alt}
              layout="responsive"
              width={500} // Ajuste o tamanho conforme necessário
              height={500} // Ajuste o tamanho conforme necessário
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageModal;
