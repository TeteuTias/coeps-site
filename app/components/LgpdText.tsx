// Texto da LGPD aceito na versão LGPD_CONSENT_VERSION. Mudou o texto? Gere uma nova versão.
export default function LgpdText() {
  return (
    <div className="max-h-[55vh] md:max-h-[40vh] overflow-y-auto rounded-md border border-[var(--cieps-line)] bg-[var(--cieps-paper)] p-3 sm:p-5 shadow-inner text-sm space-y-4">
        <p>
            Em conformidade com a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018)</strong>, solicitamos o seu consentimento para a coleta e tratamento dos seus dados pessoais.
        </p>

        <div>
            <h3 className="font-bold text-base text-[var(--cieps-ink)]">1. Finalidade do Tratamento</h3>
            {/* Correção: Usando div em vez de p para não dar erro de Hydration com a tag ul */}
            <div className="mt-1 space-y-2 text-[var(--cieps-muted)]">
                <p>Os dados fornecidos neste formulário (incluindo Nome, CPF, contato, endereço e dados acadêmicos) serão utilizados exclusivamente para:</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Viabilizar sua inscrição e participação no evento;</li>
                    <li>Emissão de credenciais, certificados e documentos fiscais legais;</li>
                    <li>Envio de comunicações importantes referentes ao evento, logística e pagamentos;</li>
                    <li>Geração de dados estatísticos anonimizados para a organização.</li>
                </ul>
            </div>
        </div>

        <div>
            <h3 className="font-bold text-base text-[var(--cieps-ink)]">2. Compartilhamento de Dados</h3>
            <p className="mt-1 text-[var(--cieps-muted)]">
                Garantimos que suas informações não serão comercializadas ou cedidas a terceiros sem relação direta com o evento. O compartilhamento ocorrerá estritamente com plataformas parceiras operacionais (como gateways de pagamento e sistemas de credenciamento) que também cumprem com as normas de segurança da LGPD.
            </p>
        </div>

        <div>
            <h3 className="font-bold text-base text-[var(--cieps-ink)]">3. Segurança da Informação</h3>
            <p className="mt-1 text-[var(--cieps-muted)]">
                Seus dados serão armazenados em ambiente seguro, protegido contra acessos não autorizados, perdas ou alterações, pelo tempo necessário para o cumprimento das finalidades descritas ou obrigações legais (como guarda de notas fiscais).
            </p>
        </div>

        <div>
            <h3 className="font-bold text-base text-[var(--cieps-ink)]">4. Direitos do Titular</h3>
            <p className="mt-1 text-[var(--cieps-muted)]">
                Você tem o direito de solicitar, a qualquer momento, o acesso, a correção, a anonimização ou a exclusão dos seus dados de nossa base, ressalvadas as obrigações legais de retenção.
            </p>
        </div>
    </div>
  );
}
