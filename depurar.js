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

<button onclick="location.reload();">Actualizar</button>




