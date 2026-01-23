window.onload = function() {
  let respuesta = confirm("SI ERES UNA PERSONA, HAZ CLIC EN ACEPTAR. DE LO CONTRARIO, HAZ CLIC EN CANCELAR.");

  if (respuesta) {
    alert("¡BIENVENIDO/A A ESTA PÁGINA WEB!");
     // Aquí la página sigue cargando normalmente
    
  } else {
    alert("ACCESO DENEGADO. SÓLO LAS PERSONAS PUEDEN ACCEDER A ESTA PÁGINA WEB.");
    window.location.href = "about:blank"; 
    // Redirige a una página en blanco
  }
};

let startY = 0;
let isPulling = false;

document.addEventListener("touchstart", (e) => {
  if (window.scrollY === 0) { // solo si está arriba del todo
    startY = e.touches[0].pageY;
    isPulling = true;
  }
});

document.addEventListener("touchmove", (e) => {
  if (!isPulling) return;
  let currentY = e.touches[0].pageY;
  if (currentY - startY > 50) { // umbral de 50px
    document.getElementById("refresh-indicator").style.display = "block";
  }
});

document.addEventListener("touchend", () => {
  if (isPulling) {
    isPulling = false;
    if (document.getElementById("refresh-indicator").style.display === "block") {
      // Acción al refrescar
      location.reload(); // recarga la página
    }
    document.getElementById("refresh-indicator").style.display = "none";
  }
});





