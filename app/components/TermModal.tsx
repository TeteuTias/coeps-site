// src/components/TermModal.tsx
"use client"

import React, { useState } from 'react';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const TermModal: React.FC<ModalProps> = ({ isOpen, onClose, onConfirm }) => {
    // Adiciona um estado para o checkbox
    const [isChecked, setIsChecked] = useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 overflow-y-auto h-full w-full flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="relative bg-white w-full max-w-xl mx-auto rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-95 md:scale-100 animate-slide-up-fade">

                {/* Botão de Fechar */}
                <button
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                    onClick={onClose}
                    aria-label="Fechar"
                >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Conteúdo do Modal */}
                <div className="p-8 space-y-6">
                    {/* Título do Modal */}
                    <h2 className="text-3xl font-bold text-gray-900 leading-tight">
                        Termo de Consentimento
                    </h2>
                    <h3 className="text-xl font-semibold text-gray-700">
                        para Tratamento de Dados Pessoais
                    </h3>

                    {/* Corpo do Termo */}
                    <div className="text-gray-600 text-base space-y-4 leading-relaxed max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                        <p>
                            Ao realizar minha inscrição no <strong className="font-semibold text-gray-800">COEPS (Congresso dos Estudantes e Profissionais da Saúde)</strong>, declaro estar ciente e de acordo com o tratamento dos meus dados pessoais fornecidos neste formulário, conforme disposto na <strong className="font-semibold text-gray-800">Lei Geral de Proteção de Dados Pessoais – LGPD (Lei nº 13.709/2018)</strong>.
                        </p>
                        <p>
                            Autorizo a organização do evento a coletar, armazenar, utilizar e, se necessário, compartilhar meus dados exclusivamente para fins relacionados à organização, comunicação, emissão de certificados, controle de participação e divulgação institucional do COEPS.
                        </p>
                        <p>
                            Os dados coletados não serão utilizados para fins comerciais nem repassados a terceiros não envolvidos com o evento, respeitando os princípios de finalidade, necessidade e segurança previstos na LGPD.
                        </p>
                        <div>
                            <h4 className="font-bold text-gray-800 mt-4">Tenho ciência de que:</h4>
                            <ul className="list-disc pl-6 mt-2 space-y-2 text-sm">
                                <li>Poderei, a qualquer momento, solicitar acesso, correção ou exclusão dos meus dados;</li>
                                <li>A qualquer tempo, poderei revogar este consentimento, mediante solicitação pelo e-mail oficial da organização;</li>
                                <li>Meus dados poderão ser utilizados para envio de informações sobre futuras edições do evento e ações educativas relacionadas, caso eu manifeste interesse.</li>
                            </ul>
                        </div>
                        <p className="font-bold mt-4 text-gray-800">
                            Declaro, portanto, que li, compreendi e estou de acordo com os termos acima.
                        </p>
                    </div>
                </div>

                {/* Rodapé - Checkbox e Botão de Ação */}
                <div className="p-8 bg-gray-50 border-t border-gray-100 rounded-b-xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <label className="flex items-center text-gray-700 cursor-pointer text-base select-none">
                        <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => setIsChecked(e.target.checked)}
                            className="form-checkbox h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 transition-colors duration-200 ease-in-out"
                        />
                        <span className="ml-3 font-medium">Li e aceito os termos acima.</span>
                    </label>
                    <button
                        onClick={onConfirm}
                        disabled={!isChecked}
                        className={`px-8 py-3 font-semibold rounded-full shadow-lg transition-all duration-200 ease-in-out
                            ${isChecked ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:ring-offset-2' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                    >
                        Confirmar e Prosseguir
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TermModal;