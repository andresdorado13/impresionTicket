//pdfjsLib.GlobalWorkerOptions.workerSrc ='https://mozilla.github.io/pdf.js/build/pdf.worker.js';
//pdfjsLib.GlobalWorkerOptions.workerSrc ='https://github.com/mozilla/pdfjs-dist';
//import pdfJsLib from "https://example.com/nombreDeLaLibreria.js";
// Loaded via <script> tag, create shortcut to access PDF.js exports.
var { pdfjsLib } = globalThis;

// The workerSrc property shall be specified.

/**
 * If you need the last version of pdf.worker.js you can get it from:
 * pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.js';
 * 
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdfWorker.js';

/**********************SERVICE WORKER******************************/
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?version=2.42')
    .then(registration => {
      //alert('Service Worker registrado con éxito:', registration);
      console.log('Service Worker registrado con éxito:', registration);
    })
    .catch(error => {
      //alert('Error al registrar el Service Worker:', error);
      console.error('Error al registrar el Service Worker:', error);
    });
    //Recibe archivos compartidos fuera de la webapp
    navigator.serviceWorker.addEventListener("message", (event) => {
      const file = event.data.file;
      var dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      displayPdf(file);
      combineAllPDFPages().then(archive => {
        fileBackup=archive;
        getPdf(createURL);
      });
    });
  }
}
/**********************************************************************/

/**************************VARIABLES GLOBALES***************************/
let fileInput;
let selected_device;
let selectorDevice = document.getElementById('selected_device');
let devices = [];
let storedDevices;
let nIntervId;
let statusTexts = ["Buscando dispositivos", "Buscando dispositivos.", "Buscando dispositivos..", "Buscando dispositivos..."];
let contenedor = document.getElementById("contenedor");
let nuevoParrafo;
let fileBackup;
let fileBackupZpl;
let changeHref;
let pdfText = '';
let totalNumPagesTam;
let zebraPrinter;
let dispFound = false;
let buttonPrint = document.getElementById('buttonToPrint');
let reloadButton = document.getElementById('reloadButton');
const headerZebraImz220 = text = '! U1 JOURNAL \r\n! U1 SETLP 0 2 18 \r\n! UTILITIES LT CR-X-LF PRINT \r\n! U1 COUNTRY LATIN9\r\n';

/********************FUNCIONES PARA BUSCAR IMPRESORAS*******************/

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

selectorDevice.addEventListener('change', function() {

  for (const device of devices) {
    if(selectorDevice.value == device.uid && selectorDevice.value != 'SelectPrinter'){
			selected_device = device;
      habilitarBoton();
      break;
		} else if (selectorDevice.value == 'SelectPrinter') {
      selected_device = null;
      deshabilitarBoton();
      return;
    }
  }
});

reloadButton.addEventListener('click', function() {
  searchPrinters();
});

/**
 * Busco las impresoras locales, solo aplica para las de la marca zebra, las 
 * Star siguen otro flujo
 */
function searchPrinters(){

  // Deshabilito el boton de busqueda para que no hagan busquedas simultaneas
  reloadButton.disabled = true;
  const sPrinter = document.getElementById('printerSelect');
  nuevoParrafo = document.getElementById("BuscandoDisp");
  nuevoParrafo.textContent = "Buscando dispositivos";
  if (sPrinter.value != 'Star') {
    buttonPrint.textContent = 'Buscando';
  }
  //document.body.appendChild(nuevoParrafo);
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
        let option = document.createElement("option");
        option.text = device.name;
        option.value = device.uid;
        selectorDevice.add(option);
      }
    }
    clearInterval(nIntervId);
    if (device_list.length > 0) {
      dispFound = true;
      nuevoParrafo.textContent = "Dispositivos encontrados"
    } else {
      nuevoParrafo.textContent = "No hay dispositivos conectados"
    }
    nIntervId = null;
    reloadValuePrinter(sPrinter);
    // Vuelvo a habilitar el boton de busqueda
    reloadButton.disabled = false;
  }, function(){
    clearInterval(nIntervId);
    nIntervId = null;
    nuevoParrafo.textContent = "Error al buscar dispositivos"
    buttonPrint.textContent = 'Sin dispositivos para imprimir';
    reloadValuePrinter(sPrinter);
    // Vuelvo a habilitar el boton de busqueda
    reloadButton.disabled = false;
  },"printer");
}
/***********************************************************************/

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
  inputFileLoad()
  createURL()
});

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

/************FUNCION PARA IMPRIMIR SEGUN TIPO DE IMPRESORA*************/

buttonPrint.addEventListener('click', function() {
  // Obtener el valor seleccionado en el elemento select
  let selectedPrinter = document.getElementById("printerSelect").value;
  // Realizar acciones según la opción seleccionada
  if (fileBackup && fileBackup.size > 0) {
    if (selectedPrinter === 'Zebra iMZ220' || selectedPrinter === 'Zebra ZQ220' ) {
      try{
        alert("Imprimiendo en impresora zebra...");
        imprimirZebraTxt();
      }catch(error){
        alert("¡Falla al imprimir! Revise la impresora y el tipo de impresora al que se encuentra conectado");
      }
    } else if(selectedPrinter === "Star") {
      try{
        alert("Imprimiendo en impresora star...");
        imprimirStar();
      }catch(error){
        alert("¡Falla al imprimir! Revise la impresora y el tipo de impresora al que se encuentra conectado");
      }
    } else {
        alert("Selecciona una impresora válida (Zebra o Star).");
    }
  } else {
    alert("No hay un archivo cargado para imprimir");
  }
});
/**********************************************************************/

/*********************FUNCIONES PARA IMPRESORA ZEBRA**********************/
var finishCallback = function(){
	alert("Proceso finalizado");	
}

var errorCallback = function(errorMessage){
	alert("Error: " + errorMessage);	
}

async function imprimirZebraZpl(){
  let zpl=await pdfToZpl(fileBackupZpl);
  const zplArchive = new Blob([zpl], { type: 'text/plain' });
  selected_device.sendFile(zplArchive, finishCallback, errorCallback);
}

async function pdfToZpl(file) {
  const pdfUrl = URL.createObjectURL(file);
  // Obtener el PDF y crear una instancia de pdfJsLib
  const loadPdf = await pdfjsLib.getDocument(pdfUrl);
  // Deserializar el PDF
  const PDFContent = await loadPdf.promise;
  // create content for print.
  //En initial position entre mas grande sea el numero constante, mas alineado a la izquierda estara, en otro caso, mas pequeño a la derecha
  // Obtener la página
  let content = '^XA~TA000~JSN^LT0^MNN^MTT^PON^PMN^LH0,0^JMA^PR5,5~SD15^JUS^LRN^CI0^XZ';
  for (let pageNumber = 1 ; pageNumber <= PDFContent.numPages ; pageNumber++) {
    const page = await PDFContent.getPage(pageNumber);
    // Obtener el contenido de texto
    const pdf = await page.getTextContent();
    // Verify exists itens on PDF
    if (!pdf.items || pdf.items.length==0) {
      alert("Saliendo de conversión");
      return;
    }
    // get scale of print
    const scale = pdf.items.map(item => {
      const [, , , , , topPosition] = item.transform;
      return topPosition;
    }).reduce((transform, nextTransform) => 
      Math.min(transform, nextTransform)
    );
    if(pageNumber!=PDFContent.numPages){
      content += '^XA^MMT^PW400^LL590^LH0,0^LS0';
    }else{
      content += '^XA^MMT^PW400^LL'+(590-scale+60)+'^LH0,0^LS0';
    }
    if(pageNumber!=PDFContent.numPages){
      pdf.items.forEach(item => {
        const [fontSize, , , fontWeight, initialPosition, topPosition] = item.transform;
        content += `^FT
                    ${390-initialPosition},
                    ${topPosition-scale}
                    ^A0I,
                    ${fontSize*(1.4)},
                    ${fontWeight}
                    ^FB
                    ${parseInt(item.width)},
                    1,0,C^FH^FD
                    ${(item.str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))}
                    ^FS`;
      })
    } else {
      pdf.items.forEach(item => {
        const [fontSize, , , fontWeight, initialPosition, topPosition] = item.transform;
        content += `^FT
                    ${390-initialPosition},
                    ${topPosition-scale+60}
                    ^A0I,
                    ${fontSize*(1.4)},
                    ${fontWeight}
                    ^FB
                    ${parseInt(item.width)},
                    1,0,C^FH^FD
                    ${(item.str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))}
                    ^FS`;
      })
    }
    //content += '^PQ1,0,1,Y^XZ';
    content += '^XZ';
  }
  contenidoZebra=content;
  console.log("****")
  console.log(content)
  return content
}
/**********************************************************************/

/******************FUNCIONES PARA IMPRESORA STAR***********************/
function createURL() {
  	changeHref = 'starpassprnt://v1/print/nopreview?';
    //back
  	changeHref = changeHref + "&back=" + encodeURIComponent(window.location.href);
    //size
    changeHref = changeHref + "&size=" + "2w7";
    //pdf
  	// changeHref = changeHref + "&pdf=" + encodeURIComponent(pdfText)
    changeHref = changeHref + "&html=" + encodeURIComponent(pdfText)
    // console.log("****")
    console.log(changeHref)
}

// function getPdf(callback) {
//   if (!fileInput.files[0]) {
//     pdfText = "";
//   } else {
//     fileBackup.arrayBuffer().then(resp => {
					
//       let binary = new Uint8Array(resp);
//       let binaryString = "";
//       for (let i=0; i<binary.byteLength; i++) {
//         binaryString += String.fromCharCode(binary[i]);
//       }

//       // base64 encoding
//       pdfText = window.btoa(binaryString);
//       createURL()
//     })
//   }
//   createURL();
// }

function imprimirStar(){
  location.href=changeHref;
}
/**********************************************************************/

/*********FUNCIONES PARA INPUT FILE O FILE RECIBIDO EXTERNAMENTE*******/
function displayPdf(file) {
  // Verificar si el archivo es de tipo PDF
  if (file.type === 'application/pdf') {
    alert("Archivo cargado correctamente");
    fileBackup=file;
    fileBackupZpl=file;
  } else {
    alert('El archivo no es de tipo PDF, cargue un nuevo')
    console.error('El archivo no es de tipo PDF');
  }
}

// Agrega un event listener al input file para el evento 'change'
function inputFileLoad() {
  fileInput.addEventListener('change', function() {
    let file = fileInput.files[0]; // Obtener el archivo seleccionado
    if (file) {
      displayPdf(file);
      combineAllPDFPages().then(archive => {
        fileBackup=archive;
        fileBackupZpl=file;
        getPdf(createURL);
      });
    } else {
      console.error('Ningún archivo seleccionado');
    }
  });
}

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
  return new File([blob], "file", { type: 'application/pdf' });
}
/**********************************************************************/

/****************************IMPRESORA ZEBRA***************************/
function txtInventaryReport(textContent){
  let selectedPrinter = document.getElementById("printerSelect").value;
  let text = '';
  if (selectedPrinter === "Zebra iMZ220") {
    text = headerZebraImz220;
    text += '           ';
  } else if (selectedPrinter === "Zebra ZQ220") {
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
    } else if (actualContent.toLowerCase().includes('ruta:')) {
      text += '\r\n';
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('vendedor:')) {
      text += '\r\n';
      text += actualContent;
    } else if (actualContent.includes('PRODUCTO')) {
      text += '\r\n \r\n \r\n';
      text += actualContent;
      text += '                            '
    } else if (actualContent.toLowerCase().includes('existencias')) {
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
        for (let spaces = 0 ; spaces < positionExistences-caracteresLineaMax ; spaces++) {
          text += ' ';
        }
        text += actualContent;
        caracteresLineaMax = 0;
        codeProductRead = 0;
        text += '\r\n';
      } else if (codeProductRead == 1 && /^\d+$/.test(actualContent) && textContent.items[content+1].str == '') { //Si el codigo de producto tiene un contenido vacio despues, siga con el siguiente producto
        for (let spaces = 0 ; spaces < positionExistences-caracteresLineaMax ; spaces++) {
          text += ' ';
        }
        text += actualContent;
        caracteresLineaMax = 0;
        codeProductRead = 0;
        text += '\r\n';
      } else if (codeProductRead == 1 && /^\d+$/.test(actualContent) && textContent.items[content+1].str != ' ' ) { //Si el codigo de producto esta al final de una pagina del pdf, verifique que haya algo en la siguiente pagina y siga
        for (let spaces = 0 ; spaces < positionExistences-caracteresLineaMax ; spaces++) {
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
  for (let spaces = 0 ; spaces < positionExistences-caracteresLineaMax ; spaces++) {
    text += ' ';
  }
  text += textContent.items[textContent.items.length-1].str;
  return text += '\r\n \r\n \r\n';
}

function txtRetailSales(textContent){
  let selectedPrinter = document.getElementById("printerSelect").value;
  let text = '';
  if (selectedPrinter === "Zebra iMZ220") {
    text = headerZebraImz220;
    text += '                ';
  } else if (selectedPrinter === "Zebra ZQ220") {
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
    if (actualContent.toLowerCase().includes('detalle')){
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('reporte')) {
      text += '\r\n \r\n         ';
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('fecha')) {
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('ruta:')) {
      text += '\r\n';
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('vendedor:')) {
      text += '\r\n';
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('producto') && !productAppear) {
      text += '\r\n \r\n \r\n';
      text += actualContent;
      text += '                     '
      productAppear = true;
    } else if (actualContent.toLowerCase().includes('cantidad')) {
      text += actualContent;
      text += '    '
    } else if (actualContent.toLowerCase().includes('total') && !totalAppear) {
      text += actualContent;
      text += '\r\n \r\n';
    } else if (actualContent.toLowerCase().includes('Inv.')) {
      text += actualContent;
      countInv++;
    } else if (actualContent.toLowerCase().includes('inicial')) {
      text += actualContent;
      text += '                '
    } else if (actualContent.toLowerCase().includes('final')) {
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
        } else if (textContent.items[content + 2].str.toLowerCase().includes('total')){
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
      if(actualContent.toLowerCase().includes('total:')){
        text += '\r\n \r\n';
        for(let spaces = 0 ; spaces < centerTotalsFinal-Math.round((actualContent.length+textContent.items[textContent.items.length-1].str.length)/2) ; spaces++) {
          text += ' ';
        }
        text += actualContent;
        text += ' ' + textContent.items[textContent.items.length-1].str;
      } else if (actualContent.toLowerCase().includes('total')) {
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

function txtPurchase(textContent) {
  let selectedPrinter = document.getElementById("printerSelect").value;
  let text = '';
  if (selectedPrinter === "Zebra iMZ220") {
    text = headerZebraImz220;
    text += '                ';
  } else if (selectedPrinter === "Zebra ZQ220") {
    text = '                ';
  }
  let actualContent;
  let afterClient = true;
  let caracteresLineaMax = 0;
  let importLine = false;
  let totalAppear = false;
  let totalAppearCount = 0;
  let caseBuyLine = false;
  let subTotal = false;
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
    if (actualContent.toLowerCase().includes('ticket')){
      text += '                  ';
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('cliente:')) {
      text += '\r\n \r\n';
      text += actualContent;
      afterClient = true;
    } else if (afterClient && textContent.items[content].hasEOL) {
      text += '\r\n';
      text += actualContent;
      afterClient = false;
    } else if (actualContent.toLowerCase().includes('dirección:')) {
      text += '\r\n';
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('fecha')) {
      text += '\r\n';
      text += actualContent;
      caseBuyLine = false;
    } else if (actualContent.toLowerCase().includes('orden')) {
      text += '\r\n';
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('condición')) {
      text += '\r\n';
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('elaboró:')) {
      text += '\r\n';
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('descripción')) {
      text += '\r\n';
      text += actualContent;
      text += '       ';
      productAppear = true;
    } else if (actualContent.toLowerCase().includes('cant.')) {
      text += actualContent;
      text += ' '
    } else if (actualContent.toLowerCase().includes('precio')) {
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('unit.')) {
      text += actualContent;
      text += '   '
    } else if (actualContent.toLowerCase().includes('total')  && !totalAppear) {
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
    } else if (actualContent.toLowerCase().includes('sub-')) {
      listProduct = false;
      text += ' \r\n'
      for (let spaces = 0; spaces<centerPage-Math.round((actualContent.length+textContent.items[content+1].str.length+textContent.items[content+2].str.length+textContent.items[content+3].str.length+textContent.items[content+4].str.length+textContent.items[content+5].str.length)/2) ; spaces++){
        text += ' '
      }
      text += actualContent;
      subTotal = true;
    } else if (actualContent.toLowerCase().includes('descuento:') || actualContent.toLowerCase().includes('impuesto:')) {
      text += '\r\n \r\n'
      for (let spaces = 0; spaces<centerPage-Math.round((actualContent.length+textContent.items[content+1].str.length+textContent.items[content+2].str.length+textContent.items[content+3].str.length+textContent.items[content+4].str.length)/2) ; spaces++){
        text += ' '
      }
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('total')  && textContent.items[content-1].str.toLowerCase().includes('sub-')) {
      text += actualContent;
    } else if (actualContent.toLowerCase().includes('total:') && totalAppear) {
      text += '\r\n \r\n'
      for (let spaces = 0; spaces<centerPage-Math.round((actualContent.length+textContent.items[content+1].str.length+textContent.items[content+2].str.length+textContent.items[content+3].str.length+textContent.items[content+4].str.length)/2) ; spaces++){
        text += ' '
      }
      text += actualContent;
    } else if(actualContent.toLowerCase().includes('importe')) {
      caracteresLineaMax = 0;
      text += '\r\n \r\n';
      text += actualContent;
      caracteresLineaMax = caracteresLineaMax + actualContent.length;
      importLine = true;
    } else if(actualContent.toLowerCase().includes('***copia***')) {
      text += '\r\n \r\n';
      for (let spaces = 0; spaces<centerPage-Math.round(actualContent.length/2) ; spaces++){
        text += ' '
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
        } else {
          text += actualContent;
        }
      } else {
        caracteresLineaMax = 0;
        text += '\r\n';
        if (actualContent != ' ') {
          text += actualContent;
        } 
        caracteresLineaMax = caracteresLineaMax + actualContent.length;
      }
    } else if (actualContent.toLowerCase().includes('productos') && countProducts == 0 ) {
      text += '\r\n \r\n'
      for (let spaces = 0; spaces < spaceProductsWithoutProm ; spaces++){
        text += ' '
      }
      text += actualContent;
      countProducts++;
    } else if (actualContent.toLowerCase().includes('productos') && countProducts == 1 ) {
      text += '\r\n'
      for (let spaces = 0; spaces < spaceProductsWithProm ; spaces++){
        text += ' '
      }
      text += actualContent + ' ';
      listProduct = false;
      countProducts++;
    } else if (actualContent.toLowerCase().includes('promocionales') && countProducts == 2 ) {
      text += actualContent;
      countProducts++;
    } else if (listProduct) {
      console.log('Actual content: '+actualContent + ', CodeProductRead: '+codeProductRead+', caracteresLineaMax: '+caracteresLineaMax+', count: '+count);
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

async function createTxtFromPdf(fileBackup) {
  if (!fileBackup) {
    return ''; // Devuelve una cadena vacía si no hay archivo
  }
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = function() {
      const arrayBuffer = this.result;

      pdfjsLib.getDocument(arrayBuffer).promise.then(async function(pdfDoc) {
        let text = '';
        const numPages = pdfDoc.numPages;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();

          for (const textItem of textContent.items) {
            if (textItem.str.toLowerCase().includes('inventario')) {
              text = txtInventaryReport(textContent);
              resolve(text);
              return;
            } else if (textItem.str.toLowerCase().includes('ticket')) {
              text = txtPurchase(textContent);
              resolve(text);
              return;
            } else if (textItem.str.toLowerCase().includes('liquidación')) {
              text = txtRetailSales(textContent);
              resolve(text);
              return;
            }
          }
          if (pageNum === numPages) {
            resolve(text);
          }
        }
      });
    };
    fileReader.readAsArrayBuffer(fileBackup);
  });
}

async function imprimirZebraTxt() {
  const txtArchive = await createTxtUtf16le(fileBackup);
  selected_device.sendFile(txtArchive, finishCallback, errorCallback);
}

async function descargarZebraTxt() {
  const txtArchive = await createTxtUtf16le();
  const url = window.URL.createObjectURL(txtArchive);
  const a = document.createElement('a');
  a.href = url;
  a.download = "fileUnifiedBackup";
  a.click();
  window.URL.revokeObjectURL(url);
}

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

/***************************IMPRESORA STAR***************************/
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
  let count = 0;
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
      if (actualContent.toLowerCase().includes('inicial')){
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
        } else if (textContent.items[content+1].str.toLowerCase().includes('total') || textContent.items[content+2].str.toLowerCase().includes('total')) {
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
      if (textContent.items[content+1].str.toLowerCase().includes('total')){
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
      if (actualContent == ' ' && textContent.items[content+1].str.toLowerCase().includes('unit')) {
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
        } else if (textContent.items[content+1].str.toLowerCase().includes('productos') || textContent.items[content+2].str.toLowerCase().includes('productos')) {
          text += actualContent + '</td></tr></tbody></table><p>&nbsp;</p><div align="center" style="font-size: 15px;font-weight: bold"><p>';
          line++;
          count = 0;
          codeProductRead = 0;
        } else if (textContent.items[content+1].str.toLowerCase().includes('sub') || textContent.items[content+2].str.toLowerCase().includes('sub')) {
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
      if (textContent.items[content+1].str.toLowerCase().includes('***')) {
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
      if (textContent.items[content+1].str.toLowerCase().includes('fecha')) {
        text += '</p><p style="font-size: 15px;font-weight: bold">';
        line++;
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
  
async function createHtmlFromPdf() {
  if (!fileBackup) {
    return ''; // Devuelve una cadena vacía si no hay archivo
  }
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();

    fileReader.onload = function() {
      const arrayBuffer = this.result;

      pdfjsLib.getDocument(arrayBuffer).promise.then(async function(pdfDoc) {
        let text = '';
        const numPages = pdfDoc.numPages;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent();

          for (const textItem of textContent.items) {
            if (textItem.str.toLowerCase().includes('inventario')) {
              text = htmlInventaryReport(textContent);
              resolve(text);
              return;
            } else if (textItem.str.toLowerCase().includes('ticket')) {
              text = htmlPurchase(textContent);
              resolve(text);
              return;
            } else if (textItem.str.toLowerCase().includes('liquidación')) {
              text = htmlRetailSales(textContent);
              resolve(text);
              return;
            }
          }
          if (pageNum === numPages) {
            resolve(text);
          }
        }
      });
    };
    fileReader.readAsArrayBuffer(fileBackup);
  });
}

async function downloadHtml() {
  const txtArchive = await createHtmlToDownload();
  const url = window.URL.createObjectURL(txtArchive);
  const a = document.createElement('a');
  a.href = url;
  a.download = "fileUnifiedBackup";
  a.click();
  window.URL.revokeObjectURL(url);
}

async function getPdf(){
  pdfText = await createHtmlFromPdf(fileBackup);
  createURL();
}

async function createHtmlToDownload(){
  const txt = await createHtmlFromPdf(fileBackup);
  let encoder = new TextEncoder();
  let utf16Array = encoder.encode(txt);
  const txtArchive = new Blob([utf16Array], { type: 'text/plain;' });
  return txtArchive;
}
