'use client'
import { useUser } from "@/lib/auth0-client"
import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import TelaLoading from "@/app/components/TelaLoading";
import PaginaErrorPadrao from "@/app/components/PaginaErrorPadrao";
import { Button, Modal, StatusBanner } from "@/app/components/cieps";
import { fetchWithTimeout, readJsonResponse } from '@/lib/client/fetchWithTimeout';
import { LGPD_CONSENT_VERSION } from '@/lib/registration-consent';

const PAISES = [
    "Afeganistão", "África do Sul", "Albânia", "Alemanha", "Andorra", "Angola", "Antígua e Barbuda", "Arábia Saudita", "Argélia", "Argentina", "Armênia", "Austrália", "Áustria", "Azerbaijão", "Bahamas", "Bangladesh", "Barbados", "Bahrein", "Bélgica", "Belize", "Benim", "Bielorrússia", "Bolívia", "Bósnia e Herzegovina", "Botsuana", "Brasil", "Brunei", "Bulgária", "Burquina Faso", "Burundi", "Butão", "Cabo Verde", "Camarões", "Camboja", "Canadá", "Catar", "Cazaquistão", "Chade", "Chile", "China", "Chipre", "Colômbia", "Comores", "Congo-Brazzaville", "Coreia do Norte", "Coreia do Sul", "Costa do Marfim", "Costa Rica", "Croácia", "Cuba", "Dinamarca", "Djibuti", "Dominica", "Egito", "El Salvador", "Emirados Árabes Unidos", "Equador", "Eritreia", "Eslováquia", "Eslovênia", "Espanha", "Essuatíni", "Estados Unidos", "Estônia", "Etiópia", "Fiji", "Filipinas", "Finlândia", "França", "Gabão", "Gâmbia", "Gana", "Geórgia", "Granada", "Grécia", "Guatemala", "Guiana", "Guiné", "Guiné Equatorial", "Guiné-Bissau", "Haiti", "Honduras", "Hungria", "Iêmen", "Ilhas Marshall", "Índia", "Indonésia", "Irã", "Iraque", "Irlanda", "Islândia", "Israel", "Itália", "Jamaica", "Japão", "Jordânia", "Kiribati", "Kuwait", "Laos", "Lesoto", "Letônia", "Líbano", "Libéria", "Líbia", "Liechtenstein", "Lituânia", "Luxemburgo", "Macedônia do Norte", "Madagascar", "Malásia", "Malaui", "Maldivas", "Mali", "Malta", "Marrocos", "Maurício", "Mauritânia", "México", "Mianmar", "Micronésia", "Moçambique", "Moldávia", "Mônaco", "Mongólia", "Montenegro", "Namíbia", "Nauru", "Nepal", "Nicarágua", "Níger", "Nigéria", "Noruega", "Nova Zelândia", "Omã", "Países Baixos", "Palau", "Panamá", "Papua Nova Guiné", "Paquistão", "Paraguai", "Peru", "Polônia", "Portugal", "Quênia", "Quirguistão", "Reino Unido", "República Centro-Africana", "República Checa", "República Democrática do Congo", "República Dominicana", "Romênia", "Ruanda", "Rússia", "Samoa", "San Marino", "Santa Lúcia", "São Cristóvão e Neves", "São Tomé e Príncipe", "São Vicente e Granadinas", "Seicheles", "Senegal", "Serra Leoa", "Sérvia", "Singapura", "Síria", "Somália", "Sri Lanka", "Sudão", "Sudão do Sul", "Suécia", "Suíça", "Suriname", "Tailândia", "Tajiquistão", "Tanzânia", "Timor-Leste", "Togo", "Tonga", "Trinidad e Tobago", "Tunísia", "Turcomenistão", "Turquia", "Tuvalu", "Ucrânia", "Uganda", "Uruguai", "Uzbequistão", "Vanuatu", "Vaticano", "Venezuela", "Vietnã", "Zâmbia", "Zimbábue"
];

export default function UpdateData() {
    const { user, isLoading } = useUser();
    const router = useRouter()

    // Estados Pessoais
    const [value_name, setValueName] = useState('');
    const [openLgpd, setOpenLgdp] = useState(false)
    const [value_telefone, setValueTelefone] = useState('');
    const [value_cpf, setValueCpf] = useState('');
    const [value_data_nascimento, setValueDataNascimento] = useState('');

    // Estados de Endereço (Novos)
    const [value_pais, setValuePais] = useState('Brasil');
    const [value_postalCode, setValuePostalCode] = useState('');
    const [value_address, setValueAddress] = useState('');
    const [value_addressNumber, setValueAddressNumber] = useState('');
    const [value_complement, setValueComplement] = useState('');
    const [value_province, setValueProvince] = useState(''); // Bairro/Província
    const [value_cidade_nome, setValueCidadeNome] = useState('');

    // Estados Acadêmicos / Outros
    const [value_situacao, setValueSituacao] = useState(''); // 'formado' ou 'estudante'
    const [value_curso, setValueCurso] = useState('');
    const [value_ano, setValueAno] = useState('');
    const [value_semestre, setValueSemestre] = useState('');
    const [value_onde_conheceu, setValueOndeConheceu] = useState('');

    const [avisoErro, setAvisoErro] = useState('')
    const [isLoadingForms, setIsLoadingForms] = useState(0)
    const [draftLoaded, setDraftLoaded] = useState(false)

    const handleChangeAvisoErro = (event) => setAvisoErro(event);
    const handleChangeSetIsLoadingForms = (bool) => setIsLoadingForms(bool);

    // Handlers
    const handleChangeName = (event) => setValueName(event.target.value);
    const handleChangeTelefone = (event) => setValueTelefone(event.target.value);
    const handleChangeCpf = (event) => setValueCpf(event.target.value);
    const handleChangeDataNascimento = (event) => setValueDataNascimento(event.target.value);

    const handleChangePais = (event) => setValuePais(event.target.value);
    const handleChangePostalCode = (event) => setValuePostalCode(event.target.value);
    const handleChangeAddress = (event) => setValueAddress(event.target.value);
    const handleChangeAddressNumber = (event) => setValueAddressNumber(event.target.value);
    const handleChangeComplement = (event) => setValueComplement(event.target.value);
    const handleChangeProvince = (event) => setValueProvince(event.target.value);
    const handleChangeCidadeNome = (event) => setValueCidadeNome(event.target.value);

    const handleChangeSituacao = (event) => setValueSituacao(event.target.value);
    const handleChangeCurso = (event) => setValueCurso(event.target.value);
    const handleChangeAno = (event) => setValueAno(event.target.value);
    const handleChangeSemestre = (event) => setValueSemestre(event.target.value);
    const handleChangeOndeConheceu = (event) => setValueOndeConheceu(event.target.value);

    useEffect(() => {
        if (!user || draftLoaded) return;
        const loadDraft = async () => {
            try {
                const response = await fetchWithTimeout('/api/get/registrationDraft', { method: 'GET' });
                if (!response.ok) throw new Error('Não foi possível carregar os dados do pagamento.');
                const draft = await response.json();
                setValueName(draft.name || '');
                setValueCpf(draft.cpfCnpj || '');
                setValueTelefone(draft.phone || '');
                setValuePostalCode(draft.postalCode || '');
                setValueAddress(draft.address || '');
                setValueAddressNumber(draft.addressNumber || '');
                setValueComplement(draft.complement || '');
                setValueProvince(draft.province || '');
                setValueCidadeNome(draft.city || '');
                setValuePais(draft.country || 'Brasil');
                setValueDataNascimento(draft.birthDate || '');
                setValueOndeConheceu(draft.referral || '');
                setValueSituacao(draft.academicStatus || '');
                setValueCurso(draft.course || '');
                setValueAno(draft.graduationYear || '');
                setValueSemestre(draft.graduationSemester || '');
            } catch (error) {
                setAvisoErro(error instanceof Error ? error.message : 'Não foi possível carregar seus dados.');
            } finally {
                setDraftLoaded(true);
            }
        };
        void loadDraft();
    }, [user, draftLoaded]);

    if (isLoading) {
        return <TelaLoading />
    }

    if (!user) {
        return <PaginaErrorPadrao title="Sua sessão expirou" message="Entre novamente para concluir seu cadastro." />
    }

    if (!draftLoaded) {
        return <TelaLoading />
    }

    const fetchData = async () => {
        if (isLoadingForms) {
            return 0
        }
        try {
            handleChangeSetIsLoadingForms(1)

            switch (true) { // NOME & EMAIL
                case (value_name.trim() == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Nome Completo"`)
                    return 0
                case (value_name.trim().length <= 4):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Nome Completo" com mais de 4 caracteres`)
                    return 0
            }
            switch (true) { // TELEFONE
                case (!/^\d+$/.test(value_telefone.trim())):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Número de telefone" com apenas números`)
                    return 0
                case (value_telefone.trim().length <= 4):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Número de telefone" corretamente`)
                    return 0
            }
            switch (true) { // CPF/CNPJ
                case (!/^\d+$/.test(value_cpf.trim())):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "CPF" com apenas números`)
                    return 0
                case (value_cpf.trim().length < 11):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`O "CPF/CNPJ" deve ter no mínimo 11 caracteres`)
                    return 0
            }
            switch (true) { // ENDEREÇO & OUTROS
                case (value_postalCode.trim() == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "CEP"`)
                    return 0
                case (value_address.trim() == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Rua/Logradouro"`)
                    return 0
                case (value_addressNumber.trim() == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o "Número" do endereço`)
                    return 0
                case (value_province.trim() == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha a "Província/Bairro"`)
                    return 0
                case (value_cidade_nome.trim() == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Nome da Cidade"`)
                    return 0
                case (value_data_nascimento.trim() == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Data de Nascimento"`)
                    return 0
                case (value_onde_conheceu.trim() == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o campo "Onde conheceu o evento"`)
                    return 0
                case (value_situacao == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Selecione se você é "Formado" ou "Estudante"`)
                    return 0
            }
            switch (true) { // ACADÊMICOS
                case (value_curso.trim() == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o seu "Curso"`)
                    return 0
                case (!/^\d+$/.test(value_ano.trim()) || value_ano.trim().length !== 4):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Preencha o "Ano" com 4 números válidos (ex: 2024)`)
                    return 0
                case (value_semestre == ""):
                    handleChangeSetIsLoadingForms(0)
                    handleChangeAvisoErro(`Selecione o "Semestre"`)
                    return 0
            }
            setOpenLgdp(true)
        } catch (error) {
            handleChangeAvisoErro(error instanceof Error ? error.message : 'Não foi possível salvar seus dados. Tente novamente.')
        } finally {
            handleChangeSetIsLoadingForms(0)
        }
    };

    return (
        <main className="cieps-page-shell flex flex-col justify-center">
            {
                openLgpd &&
                <LgpdModal
                    open={openLgpd}
                    onClose={() => { setOpenLgdp(false) }}
                    onConfirm={async () => {
                        setIsLoadingForms(true)
                        // Payload rigorosamente tipado para evitar crashes no Banco
                        const response = await fetchWithTimeout('/api/post/updateData', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                "nome": value_name.trim(),
                                "cpf": value_cpf.trim(),
                                "numero_telefone": value_telefone.trim(),
                                "address": value_address,
                                "addressNumber": value_addressNumber.trim(),
                                "complement": value_complement.substring(0, 255),
                                "province": value_province,
                                "postalCode": value_postalCode,
                                "cidade": value_cidade_nome.trim(),
                                "pais": value_pais,
                                "cidade_nome": value_cidade_nome,
                                "data_nascimento": value_data_nascimento,
                                "onde_conheceu": value_onde_conheceu,
                                "situacao_academica": value_situacao,
                                "curso": value_curso,
                                "ano_conclusao": value_ano,
                                "semestre_conclusao": value_semestre,
                                "lgpdAccepted": true,
                                "lgpdVersion": LGPD_CONSENT_VERSION
                            })
                        })

                        if (!response.ok) {
                            setIsLoadingForms(false)
                            const responseJson = await readJsonResponse(response)
                            handleChangeAvisoErro(responseJson?.message || "Não foi possível salvar seus dados. Tente novamente.")
                            handleChangeSetIsLoadingForms(0)
                            throw new Error('Erro ao carregar os dados');
                        }
                        router.push('/painel/suaInscricaoFoiConfirmada')
                        router.refresh()
                    }} // ………………
                    isLoading={Boolean(isLoadingForms)}
                />}
            <AvisoModal texto={avisoErro} handler={handleChangeAvisoErro} />
            {
                isLoadingForms ? (
                    <div className="fixed inset-0 z-40 flex items-center justify-center bg-tinta/20 backdrop-blur-sm z-[100000]" role="status" aria-live="polite">
                        <div className="cieps-surface rounded-lg px-6 py-4 font-bold text-tinta">Salvando cadastro…</div>
                    </div>
                ) : null
            }
            <div className={`${avisoErro || isLoadingForms ? "pointer-events-none" : ""} mx-auto w-full max-w-3xl`} aria-hidden={Boolean(avisoErro) || Boolean(isLoadingForms)}>
                <div className="cieps-surface flex flex-col rounded-lg p-5 lg:p-10">
                    <div className="text-center mb-6">
                        <span className="cieps-kicker">Cadastro do congressista</span>
                        <h1 className="cieps-display mt-3 text-[clamp(2rem,5vw,3.6rem)] font-semibold leading-none text-tinta">Complete sua inscrição</h1>
                        <p className="mt-3 text-muted">Seu pagamento foi confirmado. Agora precisamos dos dados do congressista para liberar o painel.</p>
                    </div>

                    <div className="flex flex-col space-y-8">

                        {/* SEÇÃO 1: Dados Pessoais */}
                        <div className="flex flex-col space-y-4">
                            <h2 className="text-lg font-bold text-goles border-b pb-2">Dados Pessoais</h2>

                            <div className="flex flex-col space-y-1">
                                <h1 className="text-sm font-semibold text-tinta">Nome completo</h1>
                                <InputComponent ariaLabel="Nome completo" placeholder="Digite seu nome" value={value_name} onChange={handleChangeName} />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="flex flex-col space-y-1">
                                    <h1 className="text-sm font-semibold text-tinta">CPF / CNPJ</h1>
                                    <InputComponent ariaLabel="CPF ou CNPJ" type_text="number" placeholder="Apenas números" value={value_cpf} onChange={handleChangeCpf} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="flex flex-col space-y-1">
                                    <h1 className="text-sm font-semibold text-tinta">Número de telefone</h1>
                                    <InputComponent ariaLabel="Número de telefone" type_text="number" placeholder="DDD + Número" value={value_telefone} onChange={handleChangeTelefone} />
                                </div>
                                <div className="flex flex-col space-y-1">
                                    <h1 className="text-sm font-semibold text-tinta">Data de nascimento</h1>
                                    <InputComponent ariaLabel="Data de nascimento" type_text="date" value={value_data_nascimento} onChange={handleChangeDataNascimento} />
                                </div>
                            </div>
                        </div>

                        {/* SEÇÃO 2: Endereço */}
                        <div className="flex flex-col space-y-4">
                            <h2 className="text-lg font-bold text-goles border-b pb-2">Endereço</h2>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="flex flex-col space-y-1">
                                    <h1 className="text-sm font-semibold text-tinta">CEP</h1>
                                    <InputComponent ariaLabel="CEP" type_text="number" placeholder="Apenas números" value={value_postalCode} onChange={handleChangePostalCode} />
                                </div>
                                <div className="flex flex-col space-y-1 text-black">
                                    <h1 className="text-sm font-semibold text-tinta">País</h1>
                                    <select
                                        className="px-4 py-2 border border-linha rounded-lg focus:outline-none focus:border-goles bg-white h-full"
                                        aria-label="País"
                                        value={value_pais}
                                        onChange={handleChangePais}
                                    >
                                        <option value="" disabled>Selecione seu país</option>
                                        {PAISES.map((pais) => (
                                            <option key={pais} value={pais}>{pais}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div className="flex flex-col space-y-1 sm:col-span-2">
                                    <h1 className="text-sm font-semibold text-tinta">Rua / Logradouro</h1>
                                    <InputComponent ariaLabel="Rua ou logradouro" placeholder="Ex: Av. Paulista" value={value_address} onChange={handleChangeAddress} />
                                </div>
                                <div className="flex flex-col space-y-1">
                                    <h1 className="text-sm font-semibold text-tinta">Número</h1>
                                    <InputComponent ariaLabel="Número do endereço" type_text="number" placeholder="Ex: 1000" value={value_addressNumber} onChange={handleChangeAddressNumber} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="flex flex-col space-y-1">
                                    <h1 className="text-sm font-semibold text-tinta">Complemento (Opcional)</h1>
                                    <InputComponent ariaLabel="Complemento" placeholder="Apto, Bloco..." value={value_complement} onChange={handleChangeComplement} />
                                </div>
                                <div className="flex flex-col space-y-1">
                                    <h1 className="text-sm font-semibold text-tinta">Bairro / Província</h1>
                                    <InputComponent ariaLabel="Bairro ou província" placeholder="Seu bairro" value={value_province} onChange={handleChangeProvince} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="flex flex-col space-y-1">
                                    <h1 className="text-sm font-semibold text-tinta">Nome da Cidade</h1>
                                    <InputComponent ariaLabel="Nome da cidade" placeholder="Ex: São Paulo" value={value_cidade_nome} onChange={handleChangeCidadeNome} />
                                </div>
                            </div>
                        </div>

                        {/* SEÇÃO 3: Situação Acadêmica */}
                        <div className="flex flex-col space-y-4">
                            <h2 className="text-lg font-bold text-goles border-b pb-2">Acadêmico & Outros</h2>

                            <div className="flex flex-col space-y-1 mb-2">
                                <h1 className="text-sm font-semibold text-tinta">Onde conheceu o evento?</h1>
                                <InputComponent ariaLabel="Onde conheceu o evento" placeholder="Ex: Instagram, Amigos..." value={value_onde_conheceu} onChange={handleChangeOndeConheceu} />
                            </div>

                            <h1 className="text-sm font-semibold text-tinta">Situação Acadêmica atual</h1>
                            <div className="flex flex-wrap gap-4 text-tinta">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input type="radio" name="situacao" value="estudante" onChange={handleChangeSituacao} checked={value_situacao === 'estudante'} className="w-4 h-4 text-goles focus:ring-goles" />
                                    <span>Sou Estudante</span>
                                </label>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <input type="radio" name="situacao" value="formado" onChange={handleChangeSituacao} checked={value_situacao === 'formado'} className="w-4 h-4 text-goles focus:ring-goles" />
                                    <span>Já sou Formado</span>
                                </label>
                            </div>

                            {value_situacao && (
                                <div className="flex flex-col space-y-4 bg-papel p-5 rounded-xl border border-linha mt-2">
                                    <div className="flex flex-col space-y-1">
                                        <h1 className="text-sm font-semibold text-tinta">Qual é o seu curso?</h1>
                                        <InputComponent ariaLabel="Curso" placeholder="Ex: Medicina / Enfermagem" value={value_curso} onChange={handleChangeCurso} />
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div className="flex flex-col space-y-1">
                                            <h1 className="text-sm font-semibold text-tinta">
                                                {value_situacao === 'formado' ? "Ano de formação" : "Ano de conclusão"}
                                            </h1>
                                            <InputComponent ariaLabel={value_situacao === 'formado' ? "Ano de formação" : "Ano de conclusão"} type_text="number" placeholder="Ex: 2024" value={value_ano} onChange={handleChangeAno} />
                                        </div>
                                        <div className="flex flex-col space-y-1 text-black">
                                            <h1 className="text-sm font-semibold text-tinta">Semestre</h1>
                                            <select
                                                className="px-4 py-2 border border-linha rounded-lg focus:outline-none focus:border-goles bg-white h-full"
                                                aria-label="Semestre"
                                                value={value_semestre}
                                                onChange={handleChangeSemestre}
                                            >
                                                <option value="" disabled>Selecione</option>
                                                <option value="1">1º Semestre</option>
                                                <option value="2">2º Semestre</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Botão Concluir */}
                        <div className="pt-2">
                            <Button
                                type="button"
                                disabled={isLoadingForms || avisoErro}
                                loading={Boolean(isLoadingForms)}
                                full
                                onClick={fetchData}
                            >
                                Salvar e continuar
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}

function AvisoModal({ texto, handler }) {
    if (!texto) {
        return null
    }
    return <Modal open={Boolean(texto)} onClose={() => handler("")} title="Revise seu cadastro">
        <StatusBanner tone="warning" title="Algumas informações precisam de atenção">{texto}</StatusBanner>
        <Button className="mt-5" full onClick={() => handler("")}>Entendi</Button>
    </Modal>
}

const InputComponent = ({ type_text = "text", placeholder, value, onChange, ariaLabel }) => {
    return (
        <div className="flex flex-col text-black">
            <input
                type={type_text}
                aria-label={ariaLabel || placeholder}
                className="w-full rounded-md border border-linha bg-white px-4 py-3 text-tinta transition-colors placeholder:text-muted focus:border-goles focus:outline-none focus:ring-2 focus:ring-goles/15"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
            />
        </div>
    );
};

function LgpdModal({ open, onClose, onConfirm, isLoading }) {
    const [agreed, setAgreed] = useState(false);

    if (!open) return null;

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Termos de Privacidade e LGPD"
            description="Por favor, leia atentamente como seus dados serão tratados antes de prosseguir."
            className="max-w-2xl"
        >
            <div className="flex flex-col space-y-4 text-[0.95rem] text-[var(--cieps-ink)]">

                {/* Scroll Box Responsivo */}
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

                {/* Checkbox de Aceite (Otimizado para Toque) */}
                <label className="flex items-start space-x-3 cursor-pointer rounded-lg border border-[var(--cieps-line)] p-3 sm:p-4 transition-colors hover:bg-[var(--cieps-paper)]">
                    <input
                        type="checkbox"
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-[var(--cieps-red)] focus:ring-[var(--cieps-red)]"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <span className="text-sm font-medium leading-snug">
                        Li e concordo com o tratamento dos meus dados pessoais para as finalidades descritas acima, nos termos da Lei nº 13.709/2018 (LGPD).
                    </span>
                </label>

                {/* Ações (Largura total no mobile, lado a lado no desktop) */}
                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end sm:pt-4">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isLoading}
                        className="w-full sm:w-auto"
                    >
                        Voltar e revisar dados
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={!agreed || Boolean(isLoading)}
                        className={`w-full sm:w-auto ${!agreed ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        Finalizar Cadastro
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
