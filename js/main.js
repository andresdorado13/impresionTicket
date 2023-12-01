var { pdfjsLib } = globalThis;

// The workerSrc property shall be specified.

/**
 * If you need the last version of pdf.worker.js you can get it from:
 * pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.js';
 * 
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdfWorker.js';

/**********************SERVICE WORKER******************************/
/**
 * Se hace registro del serviceWorker y manejo de eventos para contener
 * un archivo
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?version=2.50')
    .then(registration => {
      console.log('Service Worker registrado con éxito:', registration);
    })
    .catch(error => {
      console.error('Error al registrar el Service Worker:', error);
    });
    //Recibe archivos compartidos fuera de la webapp
    navigator.serviceWorker.addEventListener('message', (event) => {
      const file = event.data.file;
      var dataTransfer = new DataTransfer();
      if (file.type === 'application/pdf') {
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileBackup = file;
        combineAllPDFPages().then(archive => {
          fileBackup=archive;
          getPdf(createURL);
        });
        alert('Archivo cargado correctamente');
      } else {
        alert('El archivo no es de tipo PDF, cargue un nuevo archivo');
      }
    });
  }
}
/**********************************************************************/

/**************************LOAD DEL PROGRAMA***************************/
/**
 * La función onLoad ejecuta el bloque de código que esta ahi después
 * de que todo el contenido de la página web ha sido cargado.
 * Este evento se dispara cuando todos los recursos de la página se han 
 * descargado y renderizado completamente.
 */
window.addEventListener('load', () => {
  registerServiceWorker()
  const sPrinter = document.getElementById('printerSelect');
  buttonPrint.disabled = true;
  buttonPrint.textContent = 'Sin dispositivos para imprimir';
  buttonPrint.style.backgroundColor = '#D1D1D1';
  sPrinter.addEventListener('change', function() {
    reloadValuePrinter(sPrinter);
  });
  let seleccionSaved = localStorage.getItem('typePrinterSelect');
  if (seleccionSaved){
    sPrinter.value = seleccionSaved;
    reloadValuePrinter(sPrinter);
  }
  searchPrinters()
  fileInput = document.getElementById('fileInput');
  inputFileLoad();
  createURL();
});
/***********************************************************************/

/**************************VARIABLES GLOBALES***************************/
let fileInput;
let selected_device;
let selectorDevice = document.getElementById('selected_device');
let devices = [];
let storedDevices;
let nIntervId;
let statusTexts = ['Buscando dispositivos', 'Buscando dispositivos.', 'Buscando dispositivos..', 'Buscando dispositivos...'];
let contenedor = document.getElementById('contenedor');
let nuevoParrafo;
let fileBackup;
let changeHref;
let pdfText = '';
let totalNumPagesTam;
let zebraPrinter;
let dispFound = false;
let buttonPrint = document.getElementById('buttonToPrint');
let reloadButton = document.getElementById('reloadButton');
/**
 * Cabecera de los tickets para la impresora zebra iMZ220
 * ! U1 JOURNAL: Este comando activa o desactiva el registro de eventos en la impresora.
 * ! U1 SETLP 0 2 18: Este comando establece la densidad de impresión, la velocidad de impresión y la anchura de la etiqueta.
 * ! UTILITIES LT CR-X-LF PRINT: Este comando indica que se imprimirá una etiqueta y acepte caracteres especiales como \r y \n.
 * ! U1 COUNTRY LATIN9: Este comando establece el país del teclado de la impresora. 
 */
const headerZebraImz220 = text = '! U1 JOURNAL ! U1 SETLP 0 2 18 ! UTILITIES LT CR-X-LF PRINT ! U1 COUNTRY LATIN9\r\n';
/***********************************************************************/

/************FUNCION PARA IMPRIMIR SEGUN TIPO DE IMPRESORA*************/
/**
 * Al darle al boton imprimir dependiendo del tipo de impresora seleccionada
 * imprime en un formato txt-linePrint para zebra y html para star
 */
buttonPrint.addEventListener('click', function() {
  // Obtener el valor seleccionado en el elemento select
  let selectedPrinter = document.getElementById('printerSelect').value;
  // Realizar acciones según la opción seleccionada
  if (fileBackup && fileBackup.size > 0) {
    if (selectedPrinter === 'Zebra iMZ220' || selectedPrinter === 'Zebra ZQ220' ) {
      try{
        alert('Imprimiendo en impresora zebra...');
        imprimirZebraTxt();
      }catch(error){
        alert('¡Falla al imprimir! Revise la impresora y el tipo de impresora al que se encuentra conectado');
      }
    } else if(selectedPrinter === 'Star') {
      try{
        alert('Imprimiendo en impresora star...');
        imprimirStar();
      }catch(error){
        alert('¡Falla al imprimir! Revise la impresora y el tipo de impresora al que se encuentra conectado');
      }
    } else {
        alert('Selecciona una impresora válida (Zebra o Star).');
    }
  } else {
    alert('No hay un archivo cargado para imprimir');
  }
});
/**********************************************************************/

/********************FUNCIONES PARA BUSCAR IMPRESORAS ZEBRA*************/

/**
 * Habilito el boton de impresión
 */
function habilitarBoton () {
  buttonPrint.disabled = false;
  buttonPrint.textContent = 'Imprimir';
  buttonPrint.style.backgroundColor = '#000000';
}

/**
 * Deshabilito el boton de impresión
 */
function deshabilitarBoton (texto = 'Elija un dispositivo') {
  buttonPrint.disabled = true;
  buttonPrint.textContent = texto;
  buttonPrint.style.backgroundColor = '#D1D1D1';
}

/**
 * Muestro un textito para indicar que está buscando las impresoras
 */
function flashText() {
  let currentText = nuevoParrafo.textContent;
  let currentIndex = statusTexts.indexOf(currentText);
  if (currentIndex === -1 || currentIndex === statusTexts.length - 1) {
    currentIndex = -1; // Reiniciar al primer elemento
  }
  nuevoParrafo.textContent = statusTexts[currentIndex + 1];
}

/**
 * Se habilita el boton de imprimir al elegir una impresora
 */
selectorDevice.addEventListener('change', function() {
  for (const device of devices) {
    if(selectorDevice.value == device.uid && selectorDevice.value != 'SelectPrinter'){
			selected_device = device;
      habilitarBoton();
      break;
		} else if (selectorDevice.value == 'SelectPrinter') {
      selected_device = null;
      deshabilitarBoton();
      break;
    }
  }
});

/**
 * Busca impresoras nuevamente
 */
reloadButton.addEventListener('click', function() {
  searchPrinters();
});

/**
 * Esconde o muestra los elementos de busqueda de impresora dependiendo de su tipo,
 * además habilita o no el botón, segun la impresora seleccionada, y si las
 * impresoras fueron seleccionadas a usar. Opciones zebra imz220, zq220 y star
 * @param {htmlElement} sPrinter 
 */
function reloadValuePrinter (sPrinter) {
  localStorage.setItem('typePrinterSelect' , sPrinter.value);
  const textDev = document.getElementById('text_devices');
  const selectDev = document.getElementById('selected_device');
  const buscandoDisp = document.getElementById('BuscandoDisp');
  if (sPrinter.value === 'Zebra iMZ220' || sPrinter.value === 'Zebra ZQ220') {
    textDev.style.display = 'block';
    selectDev.style.display = 'block';
    buscandoDisp.style.display = 'block';
    reloadButton.style.display = 'block';
    if (dispFound && selected_device) {
      habilitarBoton();
    } else if (dispFound) {
      deshabilitarBoton();
    } else {
      deshabilitarBoton('Sin dispositivos para imprimir');
    }
  } else {
    textDev.style.display = 'none';
    selectDev.style.display = 'none';
    buscandoDisp.style.display = 'none';
    reloadButton.style.display = 'none';
    habilitarBoton();
  }
}

/**
 * Busco las impresoras locales, solo aplica para las de la marca zebra, las 
 * Star siguen otro flujo
 */
function searchPrinters(){
  // Deshabilito el boton de busqueda para que no hagan busquedas simultaneas
  reloadButton.disabled = true;
  const sPrinter = document.getElementById('printerSelect');
  nuevoParrafo = document.getElementById('BuscandoDisp');
  nuevoParrafo.textContent = 'Buscando dispositivos';
  if (sPrinter.value != 'Star') {
    buttonPrint.textContent = 'Buscando';
  }
  nIntervId = setInterval(flashText, 1000);
  //Get the default device from the application as a first step. Discovery takes longer to complete.
  //Discover any other devices available to the application
  BrowserPrint.getLocalDevices(function(device_list){

    // Itero la lista de dispositivos encontrados para agregarlos al select y al array de dispositivos
    for (const device of device_list) {
      
      // Solo agrego el elemento si no se encontraba anteriormente
      let deviceExists = devices.some(d => d.uid == device.uid);
      if (!deviceExists) {
        devices.push(device);
        let option = document.createElement('option');
        option.text = device.name;
        option.value = device.uid;
        selectorDevice.add(option);
      }
    }
    clearInterval(nIntervId);
    if (device_list.length > 0) {
      dispFound = true;
      nuevoParrafo.textContent = 'Dispositivos encontrados'
    } else {
      nuevoParrafo.textContent = 'No hay dispositivos conectados'
    }
    nIntervId = null;
    reloadValuePrinter(sPrinter);
    // Vuelvo a habilitar el boton de busqueda
    reloadButton.disabled = false;
  }, function(){
    clearInterval(nIntervId);
    nIntervId = null;
    nuevoParrafo.textContent = 'Error al buscar dispositivos'
    buttonPrint.textContent = 'Sin dispositivos para imprimir';
    reloadValuePrinter(sPrinter);
    // Vuelvo a habilitar el boton de busqueda
    reloadButton.disabled = false;
  },'printer');
}
/***********************************************************************/

/***********************FUNCIONES PARA INPUT FILE**********************/
/**
 * Esta función al momento de que se cargue un archivo en el file input
 * verifica que sea un pdf, en caso de serlo, se guarda en una variable
 * donde sera manejada para combinarse sus paginas en una sola con la
 * función combineAllPDFPages y se crea una URL que se usaria para la
 * impresión en la impresora star.
 */
function inputFileLoad() {
  fileInput.addEventListener('change', function() {
    let file = fileInput.files[0]; // Obtener el archivo seleccionado
    if (file) {
      if (file.type === 'application/pdf') {
        fileBackup = file;
        combineAllPDFPages().then(archive => {
          fileBackup=archive;
          getPdf(createURL);
        });
        alert('Archivo cargado correctamente');
      } else {
        fileInput.value = '';
        alert('El archivo no es de tipo PDF, cargue uno nuevo');
      }
    } else {
      console.error('Ningún archivo seleccionado');
    }
  });
}

/**
 * Combina todas las paginas del pdf en una sola pagina
 * @returns {Promise<File>} Archivo pdf generado de una sola pagina
 */
async function combineAllPDFPages() {
  const pdfBytes = await fetch(URL.createObjectURL(fileBackup)).then((res) => res.arrayBuffer());
  const pdfDoc = await PDFLib.PDFDocument.create();
  const fileBackupPdf = await PDFLib.PDFDocument.load(pdfBytes);
  originalPage = await pdfDoc.embedPage(fileBackupPdf.getPages()[0]);
  preambleDims = originalPage.scale(1.0);
  const preambleProbe = originalPage.scale(2.0);
  totalNumPagesTam = 8.3*fileBackupPdf.getPages().length*100;
  const page = pdfDoc.addPage([preambleDims.width,preambleDims.height*fileBackupPdf.getPages().length]);
  for(paginaActual=0 ; paginaActual<fileBackupPdf.getPages().length ; paginaActual++){
    originalPage = await pdfDoc.embedPage(fileBackupPdf.getPages()[paginaActual]);
    preambleDims = originalPage.scale(1.0);
    page.drawPage(originalPage, {
      ...preambleDims,
      x: page.getWidth() / preambleDims.width,
      y: (page.getHeight() / preambleDims.height)+(preambleDims.height*(fileBackupPdf.getPages().length-(paginaActual+1))),
    });
  }
  const mergedPdfBytes = await pdfDoc.save();
  const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
  return new File([blob], 'file', { type: 'application/pdf' });
}
/**********************************************************************/

/*********************FUNCIONES PARA IMPRESORA ZEBRA**********************/
/**
 * Crea un archivo txt del pdf que se le mande y es formateado segun el ticket
 * a imprimir
 * @param {File} fileBackup - Archivo pdf con las paginas combinadas en una sola
 * @returns {Promise<String>} Promise que se resuelve en un string con el contenido parseado del pdf a txt 
 */
async function createTxtFromPdf(fileBackup) {
  const pageNum = 1;
  if (!fileBackup) {
    return ''; // Devuelve una cadena vacía si no hay archivo
  }
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = function() {
      const arrayBuffer = this.result;

      pdfjsLib.getDocument(arrayBuffer).promise.then(async function(pdfDoc) {
        let text = '';
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        //Revisa que tipo de ticket es para formatear en txt
        for (const textItem of textContent.items) {
          //Crea el txt en caso de que el ticket sea de inventario
          if (textItem.str.toLowerCase().includes('inventario')) {
            text = txtInventaryReport(textContent);
            resolve(text);
            break;
          } //Crea el txt en caso de que el ticket sea de ticket de venta 
          else if (textItem.str.toLowerCase().includes('ticket')) {
            text = txtPurchase(textContent);
            resolve(text);
            break;
          } //Crea el txt en caso de que el ticket sea de reporte de liquidación
          else if (textItem.str.toLowerCase().includes('liquidación')) {
            text = txtRetailSales(textContent);
            resolve(text);
            break;
          }
        }
        if (pageNum === numPages) {
          resolve(text);
        }
      });
    };
    fileReader.readAsArrayBuffer(fileBackup);
  });
}

/**
 * Crea un archivo txt y se envia a la impresora zebra a imprimir
 */
async function imprimirZebraTxt() {
  const txtArchive = await createTxtUtf16le(fileBackup);
  selected_device.sendFile(txtArchive, finishCallback, errorCallback);
}

/**
 * Es un proceso que se muestra cuando la impresión finaliza
 */
var finishCallback = function(){
	alert('Proceso finalizado');	
}

/**
 * Función que arroja un error en caso de que la impresora zebra falle
 */
var errorCallback = function(errorMessage){
	alert('Error: ' + errorMessage);	
}

/**
 * Sirve para descargar el pdf parseado a txt para la zebra
 */
async function descargarZebraTxt() {
  const txtArchive = await createTxtUtf16le();
  const url = window.URL.createObjectURL(txtArchive);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fileUnifiedBackup';
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * Crea un archivo con el pdf parseado para la zebra
 * @throws
 * @returns {Promise<Blob>} Archivo generado en utf-16le
 */
async function createTxtUtf16le() {
  try {
    const txt = await createTxtFromPdf(fileBackup);
    const bytes = utf16le(txt);
    const txtArchive = new Blob([bytes], { type: 'text/plain' });
    return txtArchive;
  } catch (error) {
    console.error('Error al crear el archivo en formato UTF-16LE:', error);
    throw error; // Puedes lanzar el error nuevamente o manejarlo de otra manera según tus necesidades.
  }
}

/**
 * Pasa el txt parseado de utf-8 a utf-16le (para el uso de acentos)
 * @returns {Uint8Array} El contenido de txt parseado del pdf, pasado a utf-16le
 */
function utf16le(text) {
  const bytes = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x10000) {
      bytes[i * 2] = code;
      bytes[i * 2 + 1] = 0;
    } else {
      bytes[i * 2] = (code >> 10) & 0x00FF;
      bytes[i * 2 + 1] = (code & 0x00FF);
    }
  }
  return bytes;
}
/**********************************************************************/

/******************FUNCIONES PARA IMPRESORA STAR***********************/
/**
 * Crea una URL base que mas adelante agrega el pdf parseado a html para imprimir
 * en la impresora star
 */
function createURL() {
  	changeHref = 'starpassprnt://v1/print/nopreview?';
  	changeHref = changeHref + '&back=' + encodeURIComponent(window.location.href);
    changeHref = changeHref + '&size=' + '2w7';
    changeHref = changeHref + '&html=' + encodeURIComponent(pdfText);
}

/**
 * Obtiene el pdf cargado a la aplicación y crea el html, el cual se guarda su
 * contenido en el pdfText y se actualiza la url para imprimir en la aplicación
 * de star
 */
async function getPdf(){
  pdfText = await createHtmlFromPdf(fileBackup);
  createURL();
}

/**
 * Se manda la url a location.ref lo que lleva a webApp abrir la aplicación
 * de star donde se imprimira el archivo
 */
function imprimirStar(){
  location.href=changeHref;
}

/**
 * Usa el pdf cargado y lo parsea a un html que sera usado mas adelante para
 * imprimir en un ticket desde la impresora star
 * @returns {Promise<String>} Promise que se resuelve en un string del pdf que fue parseado a html
 */
async function createHtmlFromPdf() {
  const pageNum = 1;
  if (!fileBackup) {
    return ''; // Devuelve una cadena vacía si no hay archivo
  }
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = function() {
      const arrayBuffer = this.result;

      pdfjsLib.getDocument(arrayBuffer).promise.then(async function(pdfDoc) {
        let text = '';
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        for (const textItem of textContent.items) {
          //Crea el txt en caso de que el ticket sea de inventario
          if (textItem.str.toLowerCase().includes('inventario')) {
            text = htmlInventaryReport(textContent);
            resolve(text);
            break;
          } //Crea el txt en caso de que el ticket sea de ticket de venta 
          else if (textItem.str.toLowerCase().includes('ticket')) {
            text = htmlPurchase(textContent);
            resolve(text);
            break;
          } //Crea el txt en caso de que el ticket sea de reporte de liquidación
          else if (textItem.str.toLowerCase().includes('liquidación')) {
            text = htmlRetailSales(textContent);
            resolve(text);
            break;
          }
        }
        if (pageNum === numPages) {
          resolve(text);
        }
      });
    };
    fileReader.readAsArrayBuffer(fileBackup);
  });
}

/**
 * Función para descargar un html generado
 */
async function downloadHtml() {
  const txtArchive = await createHtmlToDownload();
  const url = window.URL.createObjectURL(txtArchive);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fileUnifiedBackup';
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * A partir del contenido html generado por el pdf, se crea un archivo
 * html para descargar
 * @returns {Promise <Blob>} Archivo html creado en un texto plano
 */
async function createHtmlToDownload(){
  const txt = await createHtmlFromPdf(fileBackup);
  let encoder = new TextEncoder();
  let utf16Array = encoder.encode(txt);
  const txtArchive = new Blob([utf16Array], { type: 'text/plain;' });
  return txtArchive;
}
/**********************************************************************/

/**
 * Esta función hace la comparación de un string con otro
 * @param {String} actualContent
 * @param {String} stringToVerifique - String que se va a comparar textualmente
 * @returns {Boolean} Retorna si ambas cadenas son iguales o no  
 */
function verifyString(actualContent, stringToVerifique){
   return actualContent.toLowerCase().includes(stringToVerifique);
}

/***************FORMATEO PARA IMPRESORA ZEBRA EN TXT******************/
/**
 * Es la función para parsear el pdf de reporte de inventario a txt
 * NOTA: Los espacios que se agregran de esta manera ' ', son usados para
 * acomodar manualmente el orden y centralización de los elementos del
 * pdf
 * @param {String} textContent
 * @returns {String} String que tiene el formato del pdf cargado a imprimir en zebra 
 */
function txtInventaryReport(textContent){
  let selectedPrinter = document.getElementById('printerSelect').value;
  let text = '';
  //Segun el modelo de impresora zebra, si es iMZ220 pone encabezado linePrint
  //en otro caso, no pone ninguna configuración
  if (selectedPrinter === 'Zebra iMZ220') {
    text = headerZebraImz220;
    text += '           ';
  } else if (selectedPrinter === 'Zebra ZQ220') {
    text = '           ';
  }
  let caracteresLineaMax = 0;
  let arriveDescription = false;
  const finalReportNamePosition = 9;
  const positionExistences = 42;
  let codeProductRead = 0;
  let actualContent;
  for (let content = 0 ; content < textContent.items.length-1 ; content++) {
    actualContent = textContent.items[content].str;
    if (content == finalReportNamePosition){
      text += '\r\n \r\n';
    } else if (verifyString(actualContent,'ruta:')) {
      text += '\r\n';
      text += actualContent;
    } else if (verifyString(actualContent,'vendedor:')) {
      text += '\r\n';
      text += actualContent;
    } else if (actualContent.includes('PRODUCTO')) {
      text += '\r\n \r\n';
      text += actualContent;
      text += '                            ';
    } else if (verifyString(actualContent,'existencias')) {
      arriveDescription = true;
      text += actualContent;
      text += '\r\n \r\n';
      content++;
    } else if (arriveDescription) {
      if (codeProductRead == 0) { //Se el primer item del producto
        codeProductRead = 1;
        text += actualContent;
        caracteresLineaMax = caracteresLineaMax + actualContent.length;
      } else if (codeProductRead == 1 && /^\d+$/.test(actualContent) && textContent.items[content+1].hasEOL) { //Si el codigo de producto tiene un enter despues, siga con el siguiente producto
        for (let spaces = 0 ; spaces < positionExistences-caracteresLineaMax-Math.round(actualContent.length/2) ; spaces++) {
          text += ' ';
        }
        text += actualContent;
        caracteresLineaMax = 0;
        codeProductRead = 0;
        text += '\r\n';
      } else if (codeProductRead == 1 && /^\d+$/.test(actualContent) && textContent.items[content+1].str == '') { //Si el codigo de producto tiene un contenido vacio despues, siga con el siguiente producto
        for (let spaces = 0 ; spaces < positionExistences-caracteresLineaMax-Math.round(actualContent.length/2) ; spaces++) {
          text += ' ';
        }
        text += actualContent;
        caracteresLineaMax = 0;
        codeProductRead = 0;
        text += '\r\n';
      } else if (codeProductRead == 1 && /^\d+$/.test(actualContent) && textContent.items[content+1].str != ' ' ) { //Si el codigo de producto esta al final de una pagina del pdf, verifique que haya algo en la siguiente pagina y siga
        for (let spaces = 0 ; spaces < positionExistences-caracteresLineaMax-Math.round(actualContent.length/2) ; spaces++) {
          text += ' ';
        }
        text += actualContent;
        text += '\r\n';
        caracteresLineaMax = 0;
        codeProductRead = 0;
      } else if (codeProductRead == 1 && textContent.items[content+1].hasEOL && /^\d+$/.test(textContent.items[content+2].str)) {
        text += actualContent;
        caracteresLineaMax = caracteresLineaMax + actualContent.length;
      } else if (codeProductRead == 1 && textContent.items[content+1].hasEOL) {
        caracteresLineaMax = 0;
        text += actualContent;
        text += '\r\n';
      } else if (codeProductRead == 1) {
        text += actualContent;
        caracteresLineaMax = caracteresLineaMax + actualContent.length;
      }
    } else {
      text += actualContent;
    }
  }
  for (let spaces = 0 ; spaces < positionExistences-caracteresLineaMax-Math.round(actualContent.length/2)-1 ; spaces++) {
    text += ' ';
  }
  text += textContent.items[textContent.items.length-1].str;
  return text += '\r\n \r\n \r\n';
}

/**
 * Es la función para parsear el pdf de reporte de liquidación a txt
 * NOTA: Los espacios que se agregran de esta manera ' ', son usados para
 * acomodar manualmente el orden y centralización de los elementos del
 * pdf
 * @param {String} textContent
 * @returns {String} String que tiene el formato del pdf cargado a imprimir en zebra
 */
function txtRetailSales(textContent){
  let selectedPrinter = document.getElementById('printerSelect').value;
  let text = '';
  //Segun el modelo de impresora zebra, si es iMZ220 pone encabezado linePrint
  //en otro caso, no pone ninguna configuración
  if (selectedPrinter === 'Zebra iMZ220') {
    text = headerZebraImz220;
    text += '                ';
  } else if (selectedPrinter === 'Zebra ZQ220') {
    text = '                ';
  }
  let caracteresLineaMax = 0;
  let countInv = 1;
  let invInicialFinal = false;
  let actualContent;
  let codeProductRead = 0;
  const positionCantidadInvFinal = 34;
  const positionTotal = 48;
  let spacesToFinal = 0;
  let totalAppear = false;
  let totalRepeats = 0;
  let centerTotalsFinal = 24;
  let productAppear = false;
  for (let content = 0 ; content < textContent.items.length-2 ; content++) {
    actualContent = textContent.items[content].str;
    if (verifyString(actualContent,'detalle')){
      text += actualContent;
    } else if (verifyString(actualContent,'reporte')) {
      text += '\r\n         ';
      text += actualContent;
    } else if (verifyString(actualContent,'fecha')) {
      text += actualContent;
    } else if (verifyString(actualContent,'ruta:')) {
      text += '\r\n';
      text += actualContent;
    } else if (verifyString(actualContent,'vendedor:')) {
      text += '\r\n';
      text += actualContent;
    } else if (verifyString(actualContent,'producto') && !productAppear) {
      text += '\r\n \r\n';
      text += actualContent;
      text += '                     ';
      productAppear = true;
    } else if (verifyString(actualContent,'cantidad')) {
      text += actualContent;
      text += '    '
    } else if (verifyString(actualContent,'total') && !totalAppear) {
      text += actualContent;
      text += '\r\n \r\n';
    } else if (verifyString(actualContent,'Inv.')) {
      text += actualContent;
      countInv++;
    } else if (verifyString(actualContent,'inicial')) {
      text += actualContent;
      text += '                ';
    } else if (verifyString(actualContent,'final')) {
      invInicialFinal = true;
      text += actualContent;
      text += '\r\n \r\n';
      content++;
    } else if (invInicialFinal) {
      if (codeProductRead == 0 && actualContent != '' && actualContent != ' ') { //Se el primer item del producto
        codeProductRead = 1;
        text += actualContent;
        caracteresLineaMax = caracteresLineaMax + actualContent.length;
      } else if (codeProductRead == 5 && /^\d+(\.\d+)?$/.test(actualContent)){
        text += actualContent;
        codeProductRead = 0;
        caracteresLineaMax = 0;
        if(textContent.items[content + 1].str == ' '){
          content++;
          text += '\r\n \r\n';
        } else if (verifyString(textContent.items[content + 2].str,'total')){
          totalAppear = true;
          invInicialFinal = false;
        } else {
          text += '\r\n \r\n';
        }
      } else if (codeProductRead == 4 && /^\d+(\.\d+)?$/.test(actualContent)){
        text += actualContent;
        codeProductRead = 5;
        caracteresLineaMax = caracteresLineaMax + actualContent.length;
        for (let spaces = 0 ; spaces < positionCantidadInvFinal-caracteresLineaMax-Math.round(textContent.items[content + 2].str.length/2) ; spaces++) {
          text += ' ';
        }
      } else if (codeProductRead == 3 && /^\$\d+(\.\d+)?$/.test(actualContent)) {
        text += actualContent;
        codeProductRead = 4;
        caracteresLineaMax = 0;
        content++;
        text += '\r\n';
      }else if (codeProductRead == 2 && /^\d+(\.\d+)?$/.test(actualContent)) {
        text += actualContent;
        codeProductRead = 3;
        caracteresLineaMax = caracteresLineaMax + actualContent.length + spacesToFinal;
        for (let spaces = 0 ; spaces < positionTotal-caracteresLineaMax-textContent.items[content + 2].str.length ; spaces++) {
          text += ' ';
        }
        spacesToFinal = 0;
      } else if (codeProductRead == 1 && /^\d+(\.\d+)?$/.test(textContent.items[content + 2].str) && /^\$\d+(\.\d+)?$/.test(textContent.items[content + 4].str)) {
        text += actualContent;
        caracteresLineaMax = caracteresLineaMax + actualContent.length;
        for (let spaces = 0 ; spaces < positionCantidadInvFinal-caracteresLineaMax-Math.round(textContent.items[content + 2].str.length/2) ; spaces++) {
          text += ' ';
          spacesToFinal++;
        }
        codeProductRead = 2;
      } else if (codeProductRead == 1 && textContent.items[content+1].hasEOL) {
        caracteresLineaMax = 0;
        text += actualContent;
        text += '\r\n';
      } else if (codeProductRead == 1) {
        text += actualContent;
        caracteresLineaMax = caracteresLineaMax + actualContent.length;
      }
    } else if (totalAppear) {
      if(verifyString(actualContent,'total:')){
        text += '\r\n \r\n';
        for(let spaces = 0 ; spaces < centerTotalsFinal-Math.round((actualContent.length+textContent.items[textContent.items.length-1].str.length)/2) ; spaces++) {
          text += ' ';
        }
        text += actualContent;
        text += ' ' + textContent.items[textContent.items.length-1].str;
      } else if (verifyString(actualContent,'total')) {
        if (totalRepeats == 0){
          text += '\r\n \r\n';
          for (let spaces = 0 ; spaces < centerTotalsFinal-Math.round((actualContent.length+textContent.items[content+1].str.length+textContent.items[content+2].str.length+textContent.items[content+3].str.length+textContent.items[content+4].str.length)/2) ; spaces++) {
            text += ' ';
          }
          text += actualContent;
        }
      } else {
        text += actualContent;
      }
    } else {
      text += actualContent;
    }
  }
  return text += '\r\n \r\n \r\n';
}

/**
 * Es la función para parsear el pdf de ticket de venta a txt
 * NOTA: Los espacios que se agregran de esta manera ' ', son usados para
 * acomodar manualmente el orden y centralización de los elementos del
 * pdf
 * @param {String} textContent
 * @returns {String} String que tiene el formato del pdf cargado a imprimir en zebra
 */
function txtPurchase(textContent) {
  let selectedPrinter = document.getElementById('printerSelect').value;
  let text = '';
  //Segun el modelo de impresora zebra, si es iMZ220 pone encabezado linePrint
  //en otro caso, no pone ninguna configuración
  if (selectedPrinter === 'Zebra iMZ220') {
    text = headerZebraImz220;
    text += '                ';
  } else if (selectedPrinter === 'Zebra ZQ220') {
    text = '                ';
  }
  let actualContent;
  let afterClient = true;
  let caracteresLineaMax = 0;
  let importLine = false;
  let totalAppear = false;
  let totalAppearCount = 0;
  let caseBuyLine = false;
  let totalPage = 48;
  const centerPage = 24;
  let codeProductRead = 0;
  let centerQuantity = 23;
  let centerPriceUnit = 33;
  let spacesToFinal = 0;
  let count = 0;
  let countProducts = 0;
  let listProduct = false;
  const spaceProductsWithoutProm = 10;
  const spaceProductsWithProm = 13;
  for (let content = 0 ; content < textContent.items.length-1 ; content++) {
    actualContent = textContent.items[content].str;
    if (verifyString(actualContent,'ticket')){
      text += '                  ';
      text += actualContent;
    } else if (verifyString(actualContent,'cliente:')) {
      text += '\r\n \r\n';
      text += actualContent;
      afterClient = true;
    } else if (afterClient && textContent.items[content].hasEOL) {
      text += '\r\n';
      text += actualContent;
      afterClient = false;
    } else if (verifyString(actualContent,'dirección:')) {
      text += '\r\n';
      text += actualContent;
    } else if (verifyString(actualContent,'fecha')) {
      text += '\r\n';
      text += actualContent;
      caseBuyLine = false;
    } else if (verifyString(actualContent,'orden')) {
      text += '\r\n';
      text += actualContent;
    } else if (verifyString(actualContent,'condición')) {
      text += '\r\n';
      text += actualContent;
    } else if (verifyString(actualContent,'elaboró:')) {
      text += '\r\n';
      text += actualContent;
    } else if (verifyString(actualContent,'descripción')) {
      text += '\r\n';
      text += actualContent;
      text += '       ';
      productAppear = true;
    } else if (verifyString(actualContent,'cant.')) {
      text += actualContent;
      text += ' ';
    } else if (verifyString(actualContent,'precio')) {
      text += actualContent;
    } else if (verifyString(actualContent,'unit.')) {
      text += actualContent;
      text += '   ';
    } else if (verifyString(actualContent,'total') && !totalAppear) {
      if (totalAppearCount == 0) {
        text += actualContent;
        text += '\r\n \r\n';
        totalAppearCount++;
        listProduct = true;
      } else {
        text += actualContent;
        text += '\r\n \r\n';
        totalAppear = true;
        listProduct = true;
        totalAppearCount++;
      }
    } else if (verifyString(actualContent,'sub-')) {
      listProduct = false;
      text += ' \r\n';
      for (let spaces = 0; spaces<centerPage-Math.round((actualContent.length+textContent.items[content+1].str.length+textContent.items[content+2].str.length+textContent.items[content+3].str.length+textContent.items[content+4].str.length+textContent.items[content+5].str.length)/2) ; spaces++){
        text += ' ';
      }
      text += actualContent;
      subTotal = true;
    } else if (verifyString(actualContent,'descuento:')|| verifyString(actualContent,'impuesto:')) {
      text += '\r\n \r\n';
      for (let spaces = 0; spaces<centerPage-Math.round((actualContent.length+textContent.items[content+1].str.length+textContent.items[content+2].str.length+textContent.items[content+3].str.length+textContent.items[content+4].str.length)/2) ; spaces++){
        text += ' ';
      }
      text += actualContent;
    } else if (verifyString(actualContent,'total')  && verifyString(textContent.items[content-1].str,'sub-')) {
      text += actualContent;
    } else if (verifyString(actualContent,'total:') && totalAppear) {
      text += '\r\n \r\n';
      for (let spaces = 0; spaces<centerPage-Math.round((actualContent.length+textContent.items[content+1].str.length+textContent.items[content+2].str.length+textContent.items[content+3].str.length+textContent.items[content+4].str.length)/2) ; spaces++){
        text += ' ';
      }
      text += actualContent;
    } else if(verifyString(actualContent,'importe')) {
      caracteresLineaMax = 0;
      text += '\r\n \r\n';
      text += actualContent;
      caracteresLineaMax = caracteresLineaMax + actualContent.length;
      importLine = true;
    } else if(verifyString(actualContent,'***copia***')) {
      text += '\r\n \r\n';
      for (let spaces = 0; spaces<centerPage-Math.round(actualContent.length/2) ; spaces++){
        text += ' ';
      }
      text += actualContent;
      text += '\r\n \r\n';
      caracteresLineaMax = 0;
      importLine = false;
      caseBuyLine = true;
    } else if(importLine) {
      caracteresLineaMax = caracteresLineaMax + actualContent.length;
      if (caracteresLineaMax < totalPage){
        if (actualContent != '') {
          text += actualContent;
        } else {
          text += ' ';
        } 
      } else {
        caracteresLineaMax = 0;
        text += '\r\n';
        if (actualContent != ' ') {
          text += actualContent;
        } 
        caracteresLineaMax = caracteresLineaMax + actualContent.length;
      }
    } else if(caseBuyLine) {
      caracteresLineaMax = caracteresLineaMax + actualContent.length;
      if (caracteresLineaMax < totalPage-1){
        if (actualContent == 'SU') {
          text += actualContent + ' ';
        } else if (verifyString(actualContent,'compra.')) {
          text += actualContent + '\r\n';
          caracteresLineaMax = 0;
        } else {
          text += actualContent;
        }
      } else if (verifyString(actualContent,'satisfacción.')) {
        text += '\r\n' + actualContent + '\r\n';
        caracteresLineaMax = 0;
      } else {
        caracteresLineaMax = 0;
        text += '\r\n';
        if (actualContent != ' ') {
          text += actualContent;
        }
        caracteresLineaMax = caracteresLineaMax + actualContent.length;
      }
    } else if (verifyString(actualContent,'productos') && countProducts == 0 ) {
      text += '\r\n \r\n';
      for (let spaces = 0; spaces < spaceProductsWithoutProm ; spaces++){
        text += ' ';
      }
      text += actualContent;
      countProducts++;
    } else if (verifyString(actualContent,'productos') && countProducts == 1 ) {
      text += '\r\n';
      for (let spaces = 0; spaces < spaceProductsWithProm ; spaces++){
        text += ' ';
      }
      text += actualContent + ' ';
      listProduct = false;
      countProducts++;
    } else if (verifyString(actualContent,'promocionales') && countProducts == 2 ) {
      text += actualContent;
      countProducts++;
    } else if (listProduct) {
      if (codeProductRead == 0 && actualContent != '' && actualContent != ' ') { //Se el primer item del producto
        codeProductRead = 1;
        text += actualContent;
        caracteresLineaMax = caracteresLineaMax + actualContent.length;
      } else if (codeProductRead == 4){
        if (count == 0) {
          text += actualContent;
          count = 1;
        } else if (count == 1) {
          text += actualContent;
          count = 2;
        } else if (count == 2) {
          text += actualContent;
          count = 3;
        } else {
          if(actualContent == ' '){
            content++;
            text += '\r\n';
          } else {
            text += '\r\n';
          }
          count = 0;
          caracteresLineaMax = 0;
          codeProductRead = 0;
        }
      } else if (codeProductRead == 3) {
        if(textContent.items[content+2].str == '$'){
          text += actualContent;
          codeProductRead = 4;
          caracteresLineaMax = caracteresLineaMax + actualContent.length + spacesToFinal;
          for (let spaces = 0 ; spaces < totalPage-caracteresLineaMax-(textContent.items[content + 2].str.length+textContent.items[content + 3].str.length+textContent.items[content + 4].str.length) ; spaces++) {
            text += ' ';
          }
          spacesToFinal = 0;
          content++;
        } else{
          text += actualContent;
          caracteresLineaMax = caracteresLineaMax + actualContent.length;
        }
      }else if (codeProductRead == 2) {
        text += actualContent;
        codeProductRead = 3;
        caracteresLineaMax = caracteresLineaMax + actualContent.length + spacesToFinal;
        spacesToFinal = 0;
        for (let spaces = 0 ; spaces < centerPriceUnit-caracteresLineaMax-Math.round((textContent.items[content + 2].str.length+textContent.items[content + 3].str.length+textContent.items[content + 4].str.length)/2) ; spaces++) {
          text += ' ';
          spacesToFinal++;
        }
        content++;
      } else if (codeProductRead == 1 && textContent.items[content + 4].str == '$') {
        text += actualContent;
        caracteresLineaMax = caracteresLineaMax + actualContent.length;
        for (let spaces = 0 ; spaces < centerQuantity-caracteresLineaMax-Math.round(textContent.items[content + 2].str.length/2) ; spaces++) {
          text += ' ';
          spacesToFinal++;
        }
        content++;
        codeProductRead = 2;
      } else if (codeProductRead == 1 && textContent.items[content+1].hasEOL) {
        caracteresLineaMax = 0;
        text += actualContent;
        text += '\r\n';
      } else if (codeProductRead == 1) {
        text += actualContent;
        caracteresLineaMax = caracteresLineaMax + actualContent.length;
      }
    } else {
      text += actualContent;
    }
  }
  return text += '\r\n \r\n \r\n';
}
/**********************************************************************/

/****************FORMATEO PARA IMPRESORA STAR EN HTML******************/
/**
 * Es la función para parsear el pdf de reporte de inventario a html
 * NOTA: El encabezado del html en 'style' tiene la acomodación y
 * espaciamiento de las tablas. La variable 'line' indicara en que
 * linea del pdf se encuentra.
 * @param {String} textContent 
 * @returns {String}
 */
function htmlInventaryReport(textContent) {
  let text = '<!DOCTYPE html>'
  +'<html>'
  +'<head>'
  +    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">'
  +    '<style>'
  +        'table {'
  +            'border-collapse: collapse;'
  +            'width: 95%;'
  +        '}'
  +        'td:nth-child(1), th:nth-child(1) {'
  +            'width: 70%;'
  +        '}'
  +        'td:nth-child(2), th:nth-child(2) {'
  +            'width: 30%;'
  +            'text-align: center;'
  +        '}'
  +    '</style>'
  +'</head>'
  +'<body>'
  +    '<div align="center" style="font-size: 15px;font-weight: bold">'
  + '<p>';
  let actualContent;
  let codeProductRead = 0;
  let line = 1;
  for (let content = 0 ; content < textContent.items.length-2 ; content++) {
    actualContent = textContent.items[content].str;
    actualContentEnter = textContent.items[content].hasEOL;
    if (line == 1) {
      if (actualContentEnter){
        text += actualContent + '</p><p>&nbsp;</p></div><p style="font-size: 15px;font-weight: bold">';
        line++;
      } else {
        text += actualContent;
      }
    } else if (line == 2 || line == 3) {
      if (actualContentEnter){
        text += actualContent + '</p><p style="font-size: 15px;font-weight: bold">';
        line++;
      } else {
        text += actualContent;
      } 
    } else if (line == 4){
      if (actualContentEnter){
        text += actualContent + '</p><p>&nbsp;</p><table style="font-size: 15px;font-weight: bold"><tbody><tr><td>';
        line++;
      } else {
        text += actualContent;
      } 
    } else if (line == 5){
      if(actualContent == ' '){
        text += '</td><td>';
      } else if (actualContentEnter || textContent.items[content+1].str != ' ') {
        text += actualContent + '</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><table style="font-size: 15px;font-weight: bold"><tbody>';
        line++;
      } else {
        text += actualContent;
      }
    } else if (line == 6){
      if (codeProductRead == 0 && actualContent != '' && actualContent != ' ') {
        codeProductRead = 1;
        text += '<tr><td>' + actualContent;
      } else if (codeProductRead == 1 && /^\d+$/.test(actualContent) && textContent.items[content+1].hasEOL) {
        text += '</td><td>' + actualContent + '</td></tr>';
        codeProductRead = 0;
      } else if (codeProductRead == 1 && /^\d+$/.test(actualContent) && textContent.items[content+1].str == '') {
        text += '</td><td>' + actualContent + '</td></tr>';
        codeProductRead = 0;
      } else if (codeProductRead == 1 && /^\d+$/.test(actualContent) && textContent.items[content+1].str != ' ' ) {
        text += '</td><td>' + actualContent + '</td></tr>';
        codeProductRead = 0;
      } else if (codeProductRead == 1) {
        if (!textContent.items[content].hasEOL){
          text += actualContent;
        } else {
          text += ' ';
        }
      }
    } 
  }
  text += '</td><td>' + textContent.items[textContent.items.length-1].str + '</td></tr></tbody></table></body></html>';
  return text;
}

/**
 * Es la función para parsear el pdf de reporte de liquidación a html
 * NOTA: El encabezado del html en 'style' tiene la acomodación y
 * espaciamiento de las tablas. La variable 'line' indicara en que
 * linea del pdf se encuentra.
 * @param {String} textContent 
 * @returns {String}
 */
function htmlRetailSales(textContent) {
  let text = '<!DOCTYPE html>'
  +'<html>'
  +'<head>'
  +    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">'
  +    '<style>'
  +        'table {'
  +            'border-collapse: collapse;'
  +            'width: 95%;'
  +        '}'
  +        'td:nth-child(1), th:nth-child(1) {'
  +            'width: 50%;'
  +        '}'
  +        'td:nth-child(2), th:nth-child(2) {'
  +            'width: 25%;'
  +            'text-align: center;'
  +        '}'
  +        'td:nth-child(3), th:nth-child(3) {'
  +            'width: 25%;'
  +            'text-align: center;'
  +        '}'
  +    '</style>'
  +'</head>'
  +'<body>'
  +    '<div align="center" style="font-size: 15px;font-weight: bold">'
  + '<p>';
  let actualContent;
  let codeProductRead = 0;
  let count = 0;
  let line = 1;
  for (let content = 0 ; content < textContent.items.length-1 ; content++) {
    actualContent = textContent.items[content].str;
    actualContentEnter = textContent.items[content].hasEOL;
    if (line == 1) {
      if (actualContentEnter){
        text += actualContent + '</p><p>&nbsp;</p><p>';
        line++;
      } else {
        text += actualContent;
      }
    } else if (line == 2) {
      if (actualContentEnter){
        text += actualContent + '</p><p>&nbsp;</p></div><p style="font-size: 15px;font-weight: bold">';
        line++;
      } else {
        text += actualContent;
      }
    } else if (line == 3 || line == 4) {
      if (actualContentEnter){
        text += actualContent + '</p><p style="font-size: 15px;font-weight: bold">';
        line++;
      } else {
        text += actualContent;
      } 
    } else if (line == 5){
      if (actualContentEnter){
        text += actualContent + '</p><p>&nbsp;</p><table style="font-size: 15px;font-weight: bold"><tbody><tr><td>';
        line++;
      } else {
        text += actualContent;
      } 
    } else if (line == 6){
      if(actualContent == ' '){
        text += '</td><td>';
      } else if (actualContentEnter) {
        text += actualContent + '</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>';
        line++;
      } else {
        text += actualContent;
      }
    } else if (line == 7){
      if (verifyString(actualContent,'inicial')){
          text += actualContent + '</td><td>';
      } else if (actualContentEnter) {
        text += actualContent + '</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><table style="font-size: 15px;font-weight: bold"><tbody>';
        line++;
      } else {
        text += actualContent;
      }
    } else if (line == 8){
      if (codeProductRead == 0 && actualContent != '' && actualContent != ' ') {
        codeProductRead = 1;
        text += '<tr><td>' + actualContent;
      } else if (codeProductRead == 5) {
        if (count == 0) {
          text += actualContent;
          count = 1;
        } else if (verifyString(textContent.items[content+1].str,'total') || verifyString(textContent.items[content+2].str,'total')) {
          text += actualContent + '</td></tr></tbody></table><p>&nbsp;</p><div align="center" style="font-size: 15px;font-weight: bold"><p>';
          line++;
          count = 0;
          codeProductRead = 0;
        } else {
          if(actualContent == ' '){
            content++;
            text += '</td></tr>';
          } else {
            text += '</td></tr>';
          }
          count = 0;
          codeProductRead = 0;
        }
      } else if (codeProductRead == 4) {
        text += actualContent + '</td><td>';
        codeProductRead = 5;
        content++;
      } else if (codeProductRead == 3) {
        if (count == 0) {
          text += actualContent;
          count = 1;
        } else {
          if(actualContent == ' '){
            content++;
            text += '</td></tr><tr><td>';
          } else {
            text += '</td></tr><tr><td>';
          }
          count = 0;
          codeProductRead = 4;
        }
      } else if (codeProductRead == 2) {
        text += actualContent + '</td><td>';
        codeProductRead = 3;
        content++;
      } else if (codeProductRead == 1 && /^\$\d+(\.\d+)?$/.test(textContent.items[content + 3].str)) {
        text += '</td><td>';
        codeProductRead = 2;
      } else if (codeProductRead == 1) {
        if (!textContent.items[content].hasEOL){
          text += actualContent;
        } else {
          text += ' ';
        }
      }
    } else if (line == 9 || line == 10 || line == 11 || line == 12) {
      if (verifyString(textContent.items[content+1].str,'total')){
        text += actualContent + '</p><p>';
        line++;
      } else {
        text += actualContent;
      }
    }
  }
  text += textContent.items[textContent.items.length-1].str + '</p></div></body></html>';
  return text;
}

/**
 * Es la función para parsear el pdf de ticket de venta a html
 * NOTA: El encabezado del html en 'style' tiene la acomodación y
 * espaciamiento de las tablas. La variable 'line' indicara en que
 * linea del pdf se encuentra.
 * @param {String} textContent 
 * @returns {String}
 */
function htmlPurchase(textContent) {
  let text = '<!DOCTYPE html>'
  +'<html>'
  +'<head>'
  +    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">'
  +    '<style>'
  +        'table {'
  +            'border-collapse: collapse;'
  +            'width: 95%;'
  +        '}'
  +        'td:nth-child(1), th:nth-child(1) {'
  +            'width: 35%;'
  +        '}'
  +        'td:nth-child(2), th:nth-child(2) {'
  +            'width: 25%;'
  +            'text-align: center;'
  +        '}'
  +        'td:nth-child(3), th:nth-child(3) {'
  +            'width: 25%;'
  +            'text-align: center;'
  +        '}'
  +        'td:nth-child(4), th:nth-child(4) {'
  +            'width: 25%;'
  +            'text-align: center;'
  +        '}'
  +    '</style>'
  +'</head>'
  +'<body>'
  +    '<div align="center" style="font-size: 15px;font-weight: bold">'
  + '<p>';
  let actualContent;
  let codeProductRead = 0;
  let count = 0;
  let line = 1;
  for (let content = 0 ; content < textContent.items.length-1 ; content++) {
    actualContent = textContent.items[content].str;
    actualContentEnter = textContent.items[content].hasEOL;
    if (line == 1) {
      if (actualContentEnter){
        text += actualContent + '</p><p>&nbsp;</p><p>';
        line++;
      } else {
        text += actualContent;
      }
    } else if (line == 2) {
      if (actualContentEnter){
        text += actualContent + '</p><p>&nbsp;</p></div><p style="font-size: 15px;font-weight: bold">';
        line++;
      } else {
        text += actualContent;
      } 
    } else if (line == 3 || line == 4 || line == 5 || line == 6 || line == 7 || line == 8) {
      if (actualContentEnter){
        text += actualContent + '</p><p style="font-size: 15px;font-weight: bold">';
        line++;
      } else {
        text += actualContent;
      } 
    } else if (line == 9) {
      if (actualContentEnter){
        text += actualContent + '</p><p>&nbsp;</p><div align="center" style="font-size: 15px;font-weight: bold"><p>';
        line++;
      } else {
        text += actualContent;
      } 
    } else if (line == 10) {
      if (actualContentEnter){
        text += actualContent + '</p></div><table style="font-size: 15px;font-weight: bold;"><tbody><tr><td>';
        line++;
      } else {
        text += actualContent;
      } 
    } else if (line == 11 || line == 14){
      if (actualContent == ' ' && verifyString(textContent.items[content+1].str,'unit')) {
        text += actualContent;
      } else if(actualContent == ' '){
        text += '</td><td>';
      } else if (actualContentEnter || textContent.items[content+1].str != ' ') {
        text += actualContent + '</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><table style="font-size: 15px;font-weight: bold"><tbody>';
        line++;
      } else {
        text += actualContent;
      }
    } else if (line == 12 || line == 15){
      if (codeProductRead == 0 && actualContent != '' && actualContent != ' ') { //Se el primer item del producto
        codeProductRead = 1;
        text += '<tr><td>' + actualContent;
      } else if (codeProductRead == 4){
        if (count == 0) {
          text += actualContent;
          count = 1;
        } else if (count == 1) {
          text += actualContent;
          count = 2;
        } else if (count == 2) {
          text += actualContent;
          count = 3;
        } else if (verifyString(textContent.items[content+1].str,'productos') || verifyString(textContent.items[content+2].str,'productos')) {
          text += actualContent + '</td></tr></tbody></table><p>&nbsp;</p><div align="center" style="font-size: 15px;font-weight: bold"><p>';
          line++;
          count = 0;
          codeProductRead = 0;
        } else if (verifyString(textContent.items[content+1].str,'sub') || verifyString(textContent.items[content+2].str,'sub')) {
          text += actualContent + '</td></tr></tbody></table><p>&nbsp;</p><div align="center" style="font-size: 15px;font-weight: bold"><p>';
          line++;
          count = 0;
          codeProductRead = 0;
        } else {
          if(actualContent == ' '){
            content++;
            text += '</td></tr>';
          } else {
            text += '</td></tr>';
          }
          count = 0;
          codeProductRead = 0;
        }
      } else if (codeProductRead == 3) {
        if(textContent.items[content+1].str == '$'){
          text += '</td><td>';
          codeProductRead = 4;
        } else{
          text += actualContent;
        }
      }else if (codeProductRead == 2) {
        text += actualContent + '</td><td>';
        codeProductRead = 3;
        content++;
      } else if (codeProductRead == 1 && textContent.items[content + 3].str == '$') {
        text += '</td><td>';
        codeProductRead = 2;
      } else if (codeProductRead == 1) {
        if (!textContent.items[content].hasEOL){
          text += actualContent;
        } else {
          text += ' ';
        }
      }
    } else if (line == 13) {
      if (actualContentEnter) {
        text += '</p></div><table style="font-size: 15px;font-weight: bold"><tbody><tr><td>';
        line++;
      } else {
        text += actualContent;
      }
    } else if (line == 16 || line == 17 || line == 18) {
      if (actualContentEnter) {
        text += '</p><p>';
        line++;
      } else {
        text += actualContent;
      }
    } else if (line == 19) {
      if (actualContentEnter) {
        text += '</p></div><p style="font-size: 15px;font-weight: bold;width: 95%">';
        line++;
      } else {
        text += actualContent;
      }
    } else if (line == 20) {
      if (verifyString(textContent.items[content+1].str,'***')) {
        text += '</p><div align="center" style="font-size: 15px;font-weight: bold"><p>';
        line++;
      } else if (textContent.items[content+1].str.length == 0) {
        text += actualContent + ' ';
      } else {
        text += actualContent;
      }
    } else if (line == 21) {
      text += actualContent + '</p></div><p style="font-size: 15px;font-weight: bold">';
      line++;
    } else if (line == 22) {
      if (verifyString(textContent.items[content+1].str,'fecha')) {
        text += '</p><p style="font-size: 15px;font-weight: bold">';
        line++;
      } else if (actualContent.includes('.')) {
        text += actualContent + '</p><p style="font-size: 15px;font-weight: bold">';
      } else if (textContent.items[content+1].str.length == 0) {
        text += actualContent + ' ';
      } else {
        text += actualContent;
      }
    } else if (line == 23) {
      text += actualContent;
    }
  }
  text += '</p></body></html>';
  return text;
}
/**********************************************************************/