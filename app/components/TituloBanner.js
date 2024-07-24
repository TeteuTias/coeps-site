export default function TituloBanner({titulo}) {
    return(
        <div className="bg-[url(Site.jpg)] flex justify-center items-center content-center font-semibold text-[30px] p-36  bg-center bg-cover ">
            <h1>{titulo}</h1>
        </div>
    )
}