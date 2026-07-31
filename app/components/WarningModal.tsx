'use client';

import { Button, Modal } from '@/components/cieps';

interface WarningModalProps {
  message: string;
  textButton: string;
  onClose: () => void;
  closeModal: (value: number) => void;
  isModal: boolean;
}

export default function WarningModal({
  message = 'Não foi possível concluir esta ação.',
  textButton = 'Fechar',
  onClose = () => undefined,
  closeModal = () => undefined,
  isModal = false,
}: WarningModalProps) {
  const close = () => {
    closeModal(0);
    onClose();
  };

  return (
    <Modal
      open={isModal}
      onClose={close}
      title="Atenção"
      description={message}
      footer={<Button onClick={close}>{textButton}</Button>}
    />
  );
}
