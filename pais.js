/* =====================================================================
   ESTADÍSTICAS ANÓNIMAS — País aproximado de los visitantes
   Cuenta cada equipo UNA sola vez para el sitio y los 4 juegos
   (todos están en davidgarcia-star.github.io). El país se calcula con la
   zona horaria del equipo: no se usa ningún servicio de ubicación ni se
   guardan datos de la persona; solo se suma 1 al país.
   ===================================================================== */
(function () {
  'use strict';
  var NS = 'miproaa-estadisticas', MARCA = 'miproaa_pais_contado_v1';
  try { if (localStorage.getItem(MARCA)) return; } catch (e) { return; }

  var tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var exactos = {
    'America/Santo_Domingo': 'do', 'America/Puerto_Rico': 'pr', 'America/Port-au-Prince': 'ht', 'America/Havana': 'cu',
    'America/Bogota': 'co', 'America/Lima': 'pe', 'America/Caracas': 've', 'America/Guayaquil': 'ec', 'America/La_Paz': 'bo',
    'America/Santiago': 'cl', 'America/Montevideo': 'uy', 'America/Asuncion': 'py', 'America/Panama': 'pa',
    'America/Costa_Rica': 'cr', 'America/Managua': 'ni', 'America/Tegucigalpa': 'hn', 'America/El_Salvador': 'sv',
    'America/Guatemala': 'gt', 'America/Jamaica': 'jm', 'America/Aruba': 'aw', 'America/Curacao': 'cw',
    'America/Port_of_Spain': 'tt', 'Pacific/Honolulu': 'us', 'Atlantic/Canary': 'es',
    'Europe/Madrid': 'es', 'Europe/Rome': 'it', 'Europe/Paris': 'fr', 'Europe/London': 'gb', 'Europe/Berlin': 'de',
    'Europe/Lisbon': 'pt', 'Europe/Amsterdam': 'nl', 'Europe/Zurich': 'ch', 'Europe/Brussels': 'be'
  };
  var pais = exactos[tz];
  if (!pais) {
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Indiana\/|Kentucky\/|North_Dakota\/)/.test(tz)) pais = 'us';
    else if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Montreal|Regina|St_Johns|Moncton)/.test(tz)) pais = 'ca';
    else if (/^America\/(Mexico_City|Cancun|Merida|Monterrey|Chihuahua|Tijuana|Hermosillo|Mazatlan|Matamoros|Bahia_Banderas|Ciudad_Juarez|Ojinaga)/.test(tz)) pais = 'mx';
    else if (/^America\/(Argentina\/|Buenos_Aires|Cordoba|Mendoza)/.test(tz)) pais = 'ar';
    else if (/^America\/(Sao_Paulo|Fortaleza|Recife|Bahia|Manaus|Belem|Maceio|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Araguaina|Santarem|Noronha)/.test(tz)) pais = 'br';
    else pais = 'otros';
  }
  fetch('https://abacus.jasoncameron.dev/hit/' + NS + '/pais-' + pais, { cache: 'no-store' })
    .then(function (r) { if (r.ok) try { localStorage.setItem(MARCA, pais); } catch (e) {} })
    .catch(function () {});
})();
