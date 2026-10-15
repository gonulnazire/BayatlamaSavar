"use client";

import Toast from "@/components/Toast";

const DISMISS_MS = 6000;

type Props = {
  productName: string;
  onUndo: () => void;
  onDismiss: () => void;
};

/** Toast'ın ince bir kullanımı: 6 saniye sonra kendiliğinden kapanır */
export default function UndoToast({ productName, onUndo, onDismiss }: Props) {
  return (
    <Toast
      message={
        <>
          <span className="font-medium">{productName}</span> listeden kaldırıldı
        </>
      }
      actionLabel="Geri al"
      onAction={onUndo}
      autoDismissMs={DISMISS_MS}
      onDismiss={onDismiss}
    />
  );
}
