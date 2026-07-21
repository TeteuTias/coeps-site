'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Gift, Percent, ShieldCheck } from 'lucide-react';

export default function Brindes() {
  return (
    <main className="cieps-benefits-page">
      <section className="cieps-benefits-hero">
        <div>
          <span className="cieps-kicker">Benefícios do congressista</span>
          <h1 className="cieps-display">Parcerias que acompanham sua jornada no CIEPS.</h1>
          <p>
            Cupons, brindes e condições especiais reunidos em um espaço simples e direto.
            Novas parcerias serão publicadas aqui conforme forem confirmadas.
          </p>
        </div>
        <Gift size={72} aria-hidden="true" />
      </section>

      <section className="cieps-benefits-grid">
        <article className="cieps-benefit-card">
          <div className="cieps-benefit-brand">
            <Image src="/images/logos/easysuture.png" alt="EasySuture" width={180} height={90} />
            <span><ShieldCheck size={16} /> Parceiro CIEPS</span>
          </div>
          <div className="cieps-benefit-copy">
            <span className="cieps-kicker">Cupom exclusivo</span>
            <h2 className="cieps-display">12% de desconto na EasySuture.</h2>
            <p>
              Use o código abaixo em compras na loja. A condição permanece válida até 30 dias
              após o encerramento do evento.
            </p>
            <div className="cieps-coupon"><Percent size={20} /><strong>CIEPS2026</strong></div>
            <Link className="cieps-button" href="https://easysuture.com.br/" target="_blank">
              Acessar a loja <ArrowUpRight size={18} />
            </Link>
          </div>
        </article>

        <aside className="cieps-benefits-note">
          <span className="cieps-kicker">Em atualização</span>
          <h2 className="cieps-display">Mais benefícios estão a caminho.</h2>
          <p>A organização está construindo novas parcerias para os participantes do I CIEPS.</p>
        </aside>
      </section>
    </main>
  );
}
