import { ButtonLink, Card, ImageBox, Kicker } from './ui';
import { buildSignupEntryPath } from '@/lib/auth-migration-notice';

export default function Inscricoes({ heroImage }: { heroImage?: string }) {
  return (
    <main className="flex min-h-screen w-full flex-col bg-papel px-6 pb-20 pt-28 md:px-10">
      <section className="mx-auto flex w-full max-w-[1320px] flex-col items-center gap-10 py-8 md:flex-row md:py-16">
        <div className="flex w-full flex-col gap-[18px] md:w-[520px]">
          <Kicker>Inscrições</Kicker>
          <h1 className="font-title text-4xl font-bold leading-tight text-tinta md:text-[46px]">
            Garanta sua vaga no I CIEPS.
          </h1>
          <p className="font-sans text-[15px] leading-relaxed text-muted">
            A 1ª Edição Internacional recebe estudantes, profissionais e pesquisadores para quatro
            dias de programação, encontros e produção científica em Araguari.
          </p>
          <ButtonLink href={buildSignupEntryPath('/painel')} className="self-start">
            Cadastrar agora
          </ButtonLink>
        </div>

        <ImageBox
          src={heroImage}
          alt="Crachá do CIEPS aplicado à identidade visual do congresso"
          label="Imagem CIEPS"
          priority
          className="h-[220px] w-full rounded-[10px] md:h-[300px] md:w-[520px]"
        />
      </section>

      <section className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-6 pt-2 md:grid-cols-2">
        <Card kicker="Normas" title="O que sua inscrição garante">
          O pagamento da taxa assegura o acesso às atividades da programação científica do evento.
        </Card>
        <Card kicker="Pagamento" title="Formas disponíveis">
          Trabalhamos com PIX, boleto bancário e cartão de crédito para concluir com praticidade.
        </Card>
        <Card
          kicker="Fluxo"
          title="Como realizar sua inscrição"
          action={
            <ButtonLink href={buildSignupEntryPath('/painel')} variant="outline" className="mt-2 self-start">
              Ir para cadastro
            </ButtonLink>
          }
        >
          Crie sua conta pelo Auth0, conclua o cadastro e siga para o pagamento. A vaga fica
          reservada na hora.
        </Card>
        <Card kicker="Políticas" title="Acesso pessoal e protegido">
          O acesso ao painel é individual, protegido por autenticação, e deve ser usado de forma
          segura durante toda a jornada do congresso.
        </Card>
      </section>
    </main>
  );
}
