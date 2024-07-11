export default function A (){
    return (
        <div className="flex flex-col content-center items-center justify-center align-middle bg-[#3E4095] min-h-screen space-y-10 pb-10">
            <h1 className="break-words text-center font-extrabold text-white text-[22px] lg:text-[35px] py-5 lg:py-10">Meus Pagamentos</h1>
            <div className="bg-white w-[90%] lg:w-[30%] p-4 space-y-6">
                <div className="text-gray-800 font-bold">
                    <h1 className="text-[14px] lg:text-[20px]">{"Histórico de pagamentos".toLocaleUpperCase()}</h1>
                    <p className="text-red-700 font-semibold">Você ainda não realizou nenhum pagamento.</p>


                </div>
                <div className="flex justify-center lg:justify-start">
                    <button className="bg-[#eb7038] text-white font-extrabold p-4">REALIZAR PAGAMENTO</button>
                </div>
            </div>
            <div className="bg-white w-[90%] lg:w-[30%] p-4 text-black">
                <p1>
                    Realize seu primerio pagamento para confirmar sua inscrição. A confirmação de seu pagamento é realizada de forma <span className="font-bold bg-yellow-400 px-1">automática</span> em até <span className="font-bold bg-yellow-400 px-1">03 dias</span>. 
                    
                </p1>
            </div>
            <div className="bg-white w-[90%] lg:w-[30%] p-4 text-black space-y-3">
                <h1>Em caso de dúvidas ou se o pagamento não for confirmado em até 03 dias, entre em contato com nossa equipe.</h1>
                <div className="flex flex-col lg:flex-row items-center content-center justify-center text-center space-x-2">
                    <div className=" flex-1 flex-col  ">
                        <h1 className="font-bold px-2 lg:bg-yellow-400">Telefone</h1>
                        <h1>64 99999-9999</h1>
                    </div>
                    <div className="flex-1 flex-col ">
                        <h1 className="font-bold px-2 lg:bg-yellow-400">Email</h1>
                        <h1>email@docoeps.com.br</h1>
                    </div>
                    <div className="flex-1 flex-col ">
                        <h1 className="font-bold px-2 lg:bg-yellow-400">Instagram</h1>
                        <h1>@doCoeps</h1>

                    </div>
                </div>
            </div>
        </div>
    )
}