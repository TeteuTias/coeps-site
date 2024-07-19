"use client"
import Link from "next/link"
//
//
export default function Inscricoes(){
    return (
        <>
        <div className="">
            <div className="bg-[url(Site.jpg)] flex content-center justify-center font-semibold text-[30px] p-16  bg-center bg-cover py-[120px] ">
                <h1>Inscrições</h1>
            </div>

            <div className="flex content-center justify-center p-10 lg:py-20">
                <div className="w-[90%] lg:w-[70%] space-y-5">
                    <h1 className="font-semibold text-slate-950 text-[30px] lg:text-[35px]">Normas da inscrição</h1>
                    <h1 className="text-black text-justify">
                        O pagamento da taxa de inscrição no evento lhe assegurará o direito de participar, somente, nas atividades 
                        constantes na programação científica do evento.
                        O não pagamento até o vencimento, poderá implicar em atualização do valor da inscrição conforme lote vigente.
                    </h1>
                </div>
            </div>

            <div className="flex content-center justify-center text-white bg-[#3e4095] p-10 py-[120px]">
                <div className="w-[90%] lg:w-[70%] space-y-5">
                    <h1 className="font-semibold  text-[30px] lg:text-[35px]">Formas de Pagamento</h1>
                    <h1 className="text-justify">
                        Atuamente, trabalhamos com três formas de pagamento: <span className="bg-red-800 font-bold">PIX</span>, <span className="bg-red-800 font-bold">Boleto Bancário</span> e <span className="bg-red-800 font-bold">Cartão de Crédito</span>.
                    </h1>
                </div>
            </div>

            <div className="flex content-center justify-center p-10 py-[60px]">
                <div className="flex flex-col w-[90%] lg:w-[70%] space-y-10">
                    <h1 className="font-semibold text-slate-950 text-[30px] lg:text-[35px]">Como Realizar Minha Inscrição</h1>
                    <h1 className="text-black text-justify">
                        Primeiro é necessário se cadastrar em nosso site. Após a realização do cadastro, você será redirecionado para a tela
                        de pagamentos. Após a confirmação automática de seu pagamento, você já estará com sua vaga garantida em nosso congresso!!  
                    </h1>
                    <Link href="/painel">
                        <button className="bg-[#3e4095] px-5 py-2">CADASTRAR</button>
                    </Link>
                </div>
            </div>
            <div className="bg-[#3e4095]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" preserveAspectRatio="none" fill="#FFFFFF" >
                    <path className=""  d="M761.9,44.1L643.1,27.2L333.8,98L0,3.8V0l1000,0v3.9"></path>
                </svg>
            </div>
            <div className="flex content-center justify-center bg-[#3e4095] text-white p-10 py-[60px]">
                <div className="w-[90%] lg:w-[70%] space-y-5">
                    <h1 className="font-semibold text-[30px] lg:text-[35px]">Políticas</h1>
                    <p className="text-justify leading-8">
                    No ato do cadastro, você precisará criar uma senha que juntamente com seu CPF ou e-mail serão as credenciais para acessar sua área de participante posteriormente
                    e ter acesso a todos os serviços oferecidos no evento.

                    O login e a senha criados são pessoais, intransferíveis e para seu conhecimento e uso exclusivo. VOCÊ deverá assegurar e proteger em quaisquer circunstâncias a confidencialidade e a segurança
                    de seu login e senha. Assim, VOCÊ não deverá revelar suas credenciais de acesso a terceiros, nem as inserir em sistemas informáticos que permitam a sua descodificação e cópia, assegurando-se de
                    que o equipamento utilizado para acesso ao nosso site
                    se encontra devidamente protegido contra softwares maliciosos e do acesso indevido por terceiros.

                    Se você descumprir as obrigações aqui apresentadas, você estará praticando ato de exclusiva responsabilidade, sendo que eventuais prejuízos decorrentes de tal ato serão 
                    suportados por VOCÊ exclusivamente.
                    </p>
                </div>
            </div>
            <div className="flex content-center justify-center p-10 lg:py-24">
                <div className="w-[90%] lg:w-[70%] space-y-5">
                    <h1 className="font-semibold text-slate-950 text-[30px] lg:text-[35px]">Cancelamento e Reembolso</h1>
                    <h1 className="text-black text-justify">
                        O Art. 49 da Lei 8.078/09 do Código de Defesa do Consumidor garante um prazo legal de 7 dias após a compra para devolução de 100% do valor pago.
                        Caso deseje realizar seu reembolso, entre em contato com nossa equipe através do nosso Email ou WhatsApp.
                        Conheça a <Link href="https://coeps.com.br/privacidade/"className="bg-yellow-300 px-1 font-semibold">Política de privacidade</Link> e <Link href="https://coeps.com.br/cookies/"className="bg-yellow-300 px-1 font-semibold">Política de cookies</Link>.
                    </h1>
                </div>
            </div>
            <div className="bg-[#3E4095] flex flex-col items-center justify-center content-center p-3">
                <h1 className=" font-bold text-[20px]">Contato</h1>
                <div className="flex p-2 flex-col space-y-10 lg:flex-row lg:items-center lg:justify-center lg:content-center lg:space-x-10 lg:space-y-0 ">
                    <div className="flex flex-row space-x-2 items-center justify-center content-center">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-5 h-5">
                        <path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"/>
                    </svg>
                    <h1>vcoeps.dadg@gmail.com</h1>
                    </div>
                    <div className="flex flex-row space-x-2 items-center justify-center content-center cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-5 h-5">
                        <path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z"/>
                    </svg>
                    <h1>(62) 98330-6426</h1>
                    </div>
                    <div className="flex flex-row space-x-2 items-center justify-center content-center cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="w-6 h-6">
                        <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/>
                    </svg>
                    <h1>Instagram</h1>
                    </div>
                </div>
                </div>
            </div>
        </>
    )
}