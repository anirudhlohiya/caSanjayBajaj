let menu = document.querySelector("#menu")
let toggle = document.querySelector("#toggle")

toggle.addEventListener("click",function(){
    menu.classList.toggle("Show_menu");
})

// NavBar
let Navbar = document.querySelector(".navbar")
window.addEventListener("scroll",function(){
    let scroll = this.window.scrollY;
    if(scroll > 100){
        Navbar.classList.add('sticky');
    }
    else{
        Navbar.classList.remove('sticky')
    }
})


// Testimonials
var splide = new Splide( '.Testimonials_Splide', {
  type:'loop',
  perPage: 3,
  gap:'2rem',
  loop:true,
  pagination:false,
  rewind : true,
  breakpoints:{
    1600:{
        perPage:2.5
    },
    1400:{
        perPage:2
    },
    1000:{
        perPage:1.2
    },
    768:{
        perPage:1
    }
  }
} );

splide.mount();
// Typed CA
var type = new Typed("#text",{
    strings: ["Accountant", "Consultancy", "Advisor"],
    typeSpeed:50,
    backSpeed:50,
    loop:true
})



document.addEventListener("DOMContentLoaded", function () {
  // Initialize EmailJS after DOM is fully loaded and SDK is available
  emailjs.init("JWMtWmUADPotmDYo2");

  const form = document.getElementById("contact-form");

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    emailjs.sendForm("service_1uhjuju", "template_ff1dkpo", form)
      .then(function () {
        alert("Message sent successfully!");
        form.reset();
      }, function (error) {
        alert("Failed to send message. Try again later.");
        console.error("EmailJS Error:", error);
      });
  });
});


