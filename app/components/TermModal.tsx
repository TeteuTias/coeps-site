'use client';

import { useState } from 'react';
import { Button, Modal } from '@/components/cieps';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function TermModalContent({ onClose, onConfirm }: Omit<ModalProps, 'isOpen'>) {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title="Termo de consentimento"
      description="Tratamento de dados pessoais para participação no I CIEPS"
      className="max-w-3xl"
      footer={<Button onClick={onConfirm} disabled={!isChecked}>Confirmar e prosseguir</Button>}
    >
      <div className="max-h-[48vh] space-y-4 overflow-y-auto pr-2 text-sm leading-7">
        <p>
          Ao realizar minha inscrição no <strong className="text-tinta">CIEPS — Congresso Internacional de Estudantes e Profissionais da Saúde</strong>, declaro estar ciente e de acordo com o tratamento dos dados pessoais fornecidos neste formulário, conforme a Lei Geral de Proteção de Dados Pessoais — LGPD (Lei nº 13.709/2018).
        </p>
        <p>
          Autorizo a organização do evento a coletar, armazenar, utilizar e, quando necessário, compartilhar meus dados exclusivamente para organização, comunicação, controle de participação e divulgação institucional do CIEPS.
        </p>
        <p>
          Os dados não serão utilizados para fins comerciais nem repassados a terceiros não envolvidos com o evento, respeitando os princípios de finalidade, necessidade e segurança previstos na LGPD.
        </p>
        <div>
          <h3 className="font-bold text-tinta">Tenho ciência de que:</h3>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>poderei solicitar acesso, correção ou exclusão dos meus dados;</li>
            <li>poderei revogar este consentimento pelo e-mail oficial da organização;</li>
            <li>comunicações sobre futuras edições dependerão do interesse manifestado.</li>
          </ul>
        </div>
        <p className="font-bold text-tinta">Declaro que li, compreendi e concordo com os termos acima.</p>
      </div>
      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-md border border-linha bg-papel p-4 text-sm font-semibold text-tinta">
        <input type="checkbox" checked={isChecked} onChange={(event) => setIsChecked(event.target.checked)} className="mt-0.5 h-5 w-5 accent-goles" />
        <span>Li e aceito os termos acima.</span>
      </label>
    </Modal>
  );
}

export default function TermModal({ isOpen, onClose, onConfirm }: ModalProps) {
  return isOpen ? <TermModalContent onClose={onClose} onConfirm={onConfirm} /> : null;
}
