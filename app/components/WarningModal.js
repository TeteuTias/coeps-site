'use client'

import React from 'react';

const WarningModal = ({ message = "MENSAGEM NÃO DEFINIDA", textButton = "FECHAR", onClose = () => { }, closeModal = () => { }, isModal = 1 }) => {
    return (
        <>
            {
                isModal ?
                    <div className=" fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                        < div className="w-[85%] sm:w-full bg-white p-6 rounded-lg shadow-lg max-w-md " >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <span className="text-yellow-500 text-2xl mr-2">⚠️</span>
                                    <h2 className="text-xl font-semibold text-gray-800">Aviso</h2>
                                </div>

                            </div>
                            <p className="mt-4 text-gray-600">{message}</p>
                            <div className="flex flex-row justify-end space-x-2 mt-6 text-right">
                                <button
                                    className="bg-yellow-500 text-white py-2 px-4 rounded hover:bg-yellow-400 transition"
                                    onClick={
                                        () => {
                                            closeModal(0)
                                            onClose()
                                        }
                                    }
                                >
                                    {textButton}
                                </button>
                            </div>
                        </div >
                    </div >
                    : ""
            }
        </>
    );
};

export default WarningModal;
