export default function TituloBanner({ titulo }: { titulo: string }) {
    return (
        <div className="flex justify-center items-center content-center font-semibold text-[30px] p-16 bg-transparent">
            <h1 className='font-coeps text-white'>{titulo.toLocaleUpperCase()}</h1>
        </div>
    )
}