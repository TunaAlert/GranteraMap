
window.parent.postMessage("loaded", "*")

function init(){
    document.querySelectorAll("h2").forEach((h2) => {
        h2.addEventListener("click", (event)=>{
            var open = h2.className.includes("open")
            if(open){
                h2.className = h2.className.replaceAll("open", "").replaceAll(/\s+/g, "")
                h2.nextElementSibling.className = h2.nextElementSibling.className.replaceAll("open", "").replaceAll(/\s+/g, "")
            }else{
                h2.className += " open"
                h2.nextElementSibling.className += " open"
            }
        })
    })

    document.querySelectorAll(".reference").forEach((reference) => {
        var ref = reference.getAttribute("ref")
        if(!ref){
            reference.className += " unknown"
        }
        reference.addEventListener("click", (event)=>{
            window.parent.postMessage({loading: true, page: ref, fallback: reference.innerText}, "*")
        })
    })

}
document.addEventListener("DOMContentLoaded", init)