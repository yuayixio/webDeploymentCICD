let quotesDiv = document.getElementById('quotes')
let catButton = document.getElementById('give-trump')

fetch('https://api.kanye.rest')
    .then(res => res.json())
    .then(quote =>{
        quotesDiv.innerHTML += `<p> ${quote.quote} </p>`
    })

catButton.addEventListener("click", evt => {
    
    let trumpDiv = document.getElementById('trump-pic')

    fetch('https://api.tronalddump.io/random/meme')
    .then(res => res.json())
    .then(trumps => {
        trumps.forEach(trump => {
            trumpDiv.innerHTML = `<h3> Compare to the current president </h3>
            <img src="${trump.url}" alt="trumpMeme" />`
        })
    })
});