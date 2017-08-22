/* cria o objeto XMLHttpRequest*/
function createRequestObject() {
   var ro;
   var browser = navigator.appName;
   if(browser == "Microsoft Internet Explorer"){
     ro = new ActiveXObject("Microsoft.XMLHTTP");
   }else{
     ro = new XMLHttpRequest();
   }
   return ro;
}

var http = createRequestObject();
/* escreve um espa�o para mostrar a imagem de processamento*/
document.write("<div id='espera'></div>");

/* faz a chamada para o xmlhttprequest e indica qual � a fun��o que recebe o retorno*/
function send(url, handle) {
   http.open('get', url);
   http.onreadystatechange = handle;
   http.send(null);
   /* mostra a imagem de processamento*/
   document.getElementById('espera').innerHTML = '<img src="espera.gif">';
}

/* esconde a imagem de processamento*/
function fim() {
	document.getElementById('espera').innerHTML = '';
}
