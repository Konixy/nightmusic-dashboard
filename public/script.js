console.log(`\u000a\u0020\u0020\u0020\u0020\u005f\u0020\u0020\u0020\u005f\u005f\u005f\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u005f\u005f\u0020\u0020\u0020\u0020\u005f\u005f\u0020\u0020\u0020\u0020\u0020\u005f\u005f\u0020\u0020\u005f\u005f\u005f\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u005f\u0020\u0020\u0020\u0020\u0020\u000a\u0020\u0020\u0020\u002f\u0020\u007c\u0020\u002f\u0020\u0028\u005f\u0029\u005f\u005f\u005f\u0020\u005f\u002f\u0020\u002f\u005f\u0020\u0020\u002f\u0020\u002f\u005f\u0020\u0020\u0020\u002f\u0020\u0020\u007c\u002f\u0020\u0020\u002f\u005f\u0020\u0020\u005f\u005f\u005f\u005f\u005f\u005f\u005f\u0028\u005f\u0029\u005f\u005f\u005f\u005f\u000a\u0020\u0020\u002f\u0020\u0020\u007c\u002f\u0020\u002f\u0020\u002f\u0020\u005f\u005f\u0020\u0060\u002f\u0020\u005f\u005f\u0020\u005c\u002f\u0020\u005f\u005f\u002f\u0020\u0020\u002f\u0020\u002f\u007c\u005f\u002f\u0020\u002f\u0020\u002f\u0020\u002f\u0020\u002f\u0020\u005f\u005f\u005f\u002f\u0020\u002f\u0020\u005f\u005f\u005f\u002f\u000a\u0020\u002f\u0020\u002f\u007c\u0020\u0020\u002f\u0020\u002f\u0020\u002f\u005f\u002f\u0020\u002f\u0020\u002f\u0020\u002f\u0020\u002f\u0020\u002f\u005f\u0020\u0020\u0020\u002f\u0020\u002f\u0020\u0020\u002f\u0020\u002f\u0020\u002f\u005f\u002f\u0020\u0028\u005f\u005f\u0020\u0020\u0029\u0020\u002f\u0020\u002f\u005f\u005f\u0020\u0020\u000a\u002f\u005f\u002f\u0020\u007c\u005f\u002f\u005f\u002f\u005c\u005f\u005f\u002c\u0020\u002f\u005f\u002f\u0020\u002f\u005f\u002f\u005c\u005f\u005f\u002f\u0020\u0020\u002f\u005f\u002f\u0020\u0020\u002f\u005f\u002f\u005c\u005f\u005f\u002c\u005f\u002f\u005f\u005f\u005f\u005f\u002f\u005f\u002f\u005c\u005f\u005f\u005f\u002f\u0020\u0020\u000a\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u002f\u005f\u005f\u005f\u005f\u002f\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u0020\u000a dev by Konixy`)

const navHome = document.getElementById('navhome')
const navPanel = document.getElementById('navpanel')
const dropdown = document.querySelectorAll('.drop-btn')


let pageName = document.title.split(' ')
pageName = pageName[0].toLowerCase()

if(pageName === 'acceuil') {
  navHome.style.textDecoration = 'underline'
} else if (pageName === 'panel' || pageName === 'settings') {
  navPanel.style.textDecoration = 'underline'
}

function inviteBot(page) {
    window.open(page, 'Inviter NightMusic', 'menubar=no, scrollbars=no, top=100, left=100, width=500, height=800');
}

function pauseMusic() {
  const alert = document.getElementById('alert')
  const button = document.getElementById('dispatcher-btn')
  var ajax = new XMLHttpRequest();
  ajax.onreadystatechange = function(){
    if(this.readyState == 4 && this.status == 200){
      if(this.response === 'paused') {
        button.classList.remove('btn-play')
        button.classList.add('btn-pause')
      } else if(this.response === 'resumed') {
        button.classList.remove('btn-pause')
        button.classList.add('btn-play')
      }
    } else if(this.status == 404) {

      alert.innerText = this.response
      alert.style.display = "block"
      setTimeout(() => {
        alert.style.display = "none"
      }, 2500)
    }
  };
  var formdata = new FormData(document.getElementById("dispatcher"));
  ajax.open("POST", "/app", true);
  ajax.send(formdata);
}

// function skip() {
  
// }

$(document).ready(() => {
  dropdown.forEach(e => {
    e.innerHTML += '<img src="https://mee6.xyz/assets/028b613c85837c6a55c1fe1867f2df21.svg" class="drop-icon">'
    e.addEventListener('click', () => {
      e.classList.toggle('active')
      document.querySelector('.dropdown').classList.toggle('active')
    })
  })
})