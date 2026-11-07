'use client'
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import TelaLoading from '@/app/components/TelaLoading';
import { Button, StatusBanner } from '@/app/components/cieps';
import { fetchWithTimeout, readJsonResponse } from '@/lib/client/fetchWithTimeout';

const inputClass = "w-full rounded-md border border-linha bg-white px-4 py-3 text-tinta transition-colors placeholder:text-muted focus:border-goles focus:outline-none focus:ring-2 focus:ring-goles/15";

// Só chega aqui (via proxy) quem já está inscrito como profissional da saúde e não tem profissão ou matrícula.
export default function CompletarCadastroSaude() {
    const router = useRouter();
    const [profissao, setProfissao] = useState('');
    const [matricula, setMatricula] = useState('');
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [erro, setErro] = useState('');

    useEffect(() => {
        fetchWithTimeout('/api/get/registrationDraft', { method: 'GET' })
            .then((response) => (response.ok ? response.json() : null))
            .then((draft) => {
                if (!draft) return;
                setProfissao(draft.profession || '');
                setMatricula(draft.municipalRegistration || '');
            })
            .catch(() => { })
            .finally(() => setLoaded(true));
    }, []);

    if (!loaded) return <TelaLoading />;

    const salvar = async (event) => {
        event.preventDefault();
        if (saving) return;
        if (!profissao.trim()) return setErro('Preencha a sua "Profissão".');
        if (!matricula.trim()) return setErro('Preencha o "Número da matrícula do município".');

        setSaving(true);
        setErro('');
        try {
            const response = await fetchWithTimeout('/api/post/completeHealthProfile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profissao: profissao.trim(), matricula_municipio: matricula.trim() }),
            });
            if (!response.ok) {
                const json = await readJsonResponse(response);
                setErro(json?.message || 'Não foi possível salvar seus dados. Tente novamente.');
                return;
            }
            router.push('/painel');
            router.refresh();
        } catch (error) {
            setErro(error instanceof Error && error.message ? error.message : 'Não foi possível salvar seus dados. Verifique sua conexão e tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-xl">
            <form onSubmit={salvar} className="cieps-surface flex flex-col gap-6 rounded-lg p-5 lg:p-10" noValidate>
                <div className="text-center">
                    <span className="cieps-kicker">Profissionais da saúde</span>
                    <h1 className="cieps-display mt-3 text-[clamp(1.8rem,4.5vw,3rem)] font-semibold leading-none text-tinta">Complete seu cadastro</h1>
                    <p className="mt-3 text-muted">
                        Para completar seu cadastro, precisamos apenas destas informações extras, conforme a nova política de inscrição para profissionais da saúde.
                    </p>
                </div>

                {erro ? (
                    <StatusBanner tone="warning" title="Revise as informações">{erro}</StatusBanner>
                ) : null}

                <label className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-tinta">Profissão</span>
                    <input
                        className={inputClass}
                        placeholder="Ex: Médico(a), Enfermeiro(a), Fisioterapeuta"
                        value={profissao}
                        onChange={(event) => setProfissao(event.target.value)}
                    />
                </label>

                <label className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-tinta">Número da matrícula do município</span>
                    <input
                        className={inputClass}
                        placeholder="Informe o número da sua matrícula"
                        maxLength={50}
                        value={matricula}
                        onChange={(event) => setMatricula(event.target.value)}
                    />
                </label>

                <Button type="submit" full loading={saving}>
                    {saving ? 'Salvando…' : 'Salvar e continuar'}
                </Button>
            </form>
        </div>
    );
}
