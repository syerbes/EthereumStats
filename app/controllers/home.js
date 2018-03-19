var Web3 = require('web3');
// Clave personal de acceso a la API. La web: https://infura.io
var APIKEY = "NGCI5392qnBiWeYFqvou";
var accToSearch = [];
var txList = [];
//Bloque de inicio
var startBlockNumber;
//Conjunto de bloques en cada tanda
var n = 1000;
//Bloque actual en la iteración
var bNumber = startBlockNumber;
//Número de bloques a buscar
var nOfBlocksToSearch = 2000;
//Número de nodos
var nodes = 5;

web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/' + APIKEY));

var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Article = mongoose.model('Article');

module.exports = function (app) {
  app.use('/', router);
};

/*
router.get('/', function (req, res, next) {
  Article.find(function (err, articles) {
    if (err) return next(err);
    res.render('index', {
      title: 'Generator-Express MVC',
      articles: articles
    });
  });
});


// Obtener el número del último bloque
router.get('/lastBlock', function (req, res){
  web3.eth.getBlockNumber().then(function(res){console.log(res)});
});

// Busca las transacciones en el bloque introducido y devuelve el hash de una
// al azar.
router.get('/searchBlock', function (req, res){
  var blockNumber = req.query.bnumber;
  web3.eth.getBlockNumber().then(function(res){
    getRandomTx(blockNumber, res, getTxDetails);
  });
});

// Dado un bloque, devuelve el hash de una transacción del mismo al azar.
function getRandomTx(blockNumber, lastBlock, callback){
  var txlength = 0;
  web3.eth.getBlock(blockNumber, false, function (error, result) {
   if (!error && result!=null){
      if (result.transactions.length == 0){
        console.log('No hay transacciones en este bloque.');
        return;
      }
      //console.log('Listado de transacciones del bloque ' + blockNumber + ':\n' + result.transactions);
      txlength = result.transactions.length; 
      console.log("El número de transacciones en este bloque es: " + txlength);
      var chosenTxNumber = Math.random() * (txlength - 1);
      var chosenTx = Math.round(chosenTxNumber);
      var txHash = result.transactions[chosenTx];
      console.log('La transacción a trackear es: ' + result.transactions[chosenTx]);
      callback(txHash, lastBlock, getTransactionsByAccount);
   } else {
      if(result == null){
        console.log('El bloque aún no se ha creado.'); 
        return;
      }
      console.log('Ha habido algún problema: ', error); 
   };
  });
};

// Dado el hash de una transacción, obtiene las wallets origen y destino, junto con
// el número de bloque. Después, calcula el árbol de transacciones posteriores (desde la wallet
// destino, así como desde las wallets a las que esta wallet realiza transacciones). La búsqueda se
// interrumpe al alcanzar el quinto nivel en el árbol de transacciones o al trackear 100000.
function getTxDetails(tx, lastBlock, callback){
  web3.eth.getTransaction(tx, function(error, result) {
    if (!error){
      console.log('Dirección origen: ' + result.from);
      console.log('Dirección destino: ' + result.to);
      console.log('El número de bloque es: ' + (result.blockNumber + 1));
      callback(result.to, result.blockNumber + 1, lastBlock, getTransactionsList);
    } else {
      console.log('Ha habido algún problema: ', error); 
    };
  });
};

// Last block 5191166
function getTransactionsByAccount(myAccount, startBlockNumber, endBlockNumber, callback) {
  console.log("El último bloque a buscar será: " + endBlockNumber);
  callback(myAccount, startBlockNumber, endBlockNumber);
};

function getTransactionsList(myAccount, startBlockNumber, endBlockNumber){
  endBlockNumber = String(parseInt(endBlockNumber)+1);
  console.log("Using endBlockNumber: " + endBlockNumber);
  console.log("Searching for transactions from account \"" + myAccount + "\" within blocks "  + startBlockNumber + " and " + endBlockNumber);
  console.log("La cuenta a buscar es: " + myAccount);
  // Seguimos buscando las demás transacciones
  iterar(myAccount, startBlockNumber, endBlockNumber);
};

function iterar(myAccount, startBlockNumber, endBlockNumber){
  var txList = {};
  var accToSearch = [];
  var nOfBlocks = [];
  var maximum = (Number(endBlockNumber)+1)-Number(startBlockNumber);
  if(Number(nOfBlocks.length) == Number(maximum)){
    //console.log("PEPITO");
  };
  //console.log(maximum);
  for (var i = startBlockNumber; i <= endBlockNumber; i++) {
      //console.log(i-Number(startBlockNumber));
      web3.eth.getBlock(i, true, function(error, result){

          //if((result.number-Number(startBlockNumber)) == Math.round((Number(endBlockNumber)-Number(startBlockNumber))/10)){
          //  console.log("Llevamos un 10% " + result.number);
          //};
          nOfBlocks.push(1);
          if(nOfBlocks.length == Math.round((Number(endBlockNumber)-Number(startBlockNumber))/10)){
            console.log("Llevamos un 10% " + result.number);
          };
          if(nOfBlocks.length == Math.round(2*(Number(endBlockNumber)-Number(startBlockNumber))/10)){
            console.log("Llevamos un 20% " + result.number);
          };
          if(nOfBlocks.length == Math.round(3*(Number(endBlockNumber)-Number(startBlockNumber))/10)){
            console.log("Llevamos un 30% " + result.number);
          };
          if(nOfBlocks.length == Math.round(4*(Number(endBlockNumber)-Number(startBlockNumber))/10)){
            console.log("Llevamos un 40% " + result.number);
          };
          if(nOfBlocks.length == Math.round(5*(Number(endBlockNumber)-Number(startBlockNumber))/10)){
            console.log("Llevamos un 50% " + result.number);
          };
          if(nOfBlocks.length == Math.round(6*(Number(endBlockNumber)-Number(startBlockNumber))/10)){
            console.log("Llevamos un 60% " + result.number);
          };
          if(nOfBlocks.length == Math.round(7*(Number(endBlockNumber)-Number(startBlockNumber))/10)){
            console.log("Llevamos un 70% " + result.number);
          };
          if(nOfBlocks.length == Math.round(8*(Number(endBlockNumber)-Number(startBlockNumber))/10)){
            console.log("Llevamos un 80% " + result.number);
          };
          if(nOfBlocks.length == Math.round(9*(Number(endBlockNumber)-Number(startBlockNumber))/10)){
            console.log("Llevamos un 90% " + result.number);
          };
          //if(nOfBlocks.length > Math.round(9*(Number(endBlockNumber)-Number(startBlockNumber))/10)){
          //  console.log(nOfBlocks.length);
          //};
          if(i == (endBlockNumber-1)){
                console.log("Estamos en el último bloque (" + i + ")");
          };
          //console.log(result.number);
          if (result != null && result.transactions != null) {
             result.transactions.forEach( function(e) {
                //problema???
                //console.log(accToSearch.includes(e.from));
                //console.log(accToSearch.length);
                if(accToSearch.length > 0){
                    if(nOfBlocks.length == maximum){
                       if (myAccount == e.from || accToSearch.includes(e.from)) {
                        txList[e.hash] = [e.from, e.to, e.blockNumber];
                        accToSearch.push(e.to);
                        console.log("FIN. La lista de transacciones es:\n"+Object.values(txList)+"\n"+ "Y el conjunto de cuentas involucradas son:\n"+accToSearch);
                       }else{
                          console.log("FIN. La lista de transacciones es:\n"+Object.values(txList)+"\n"+ "Y el conjunto de cuentas involucradas son:\n"+accToSearch);
                       };
                    }else{
                      if (myAccount == e.from || accToSearch.includes(e.from)) {
                        txList[e.hash] = [e.from, e.to, e.blockNumber];
                        accToSearch.push(e.to);
                      };
                   }; 
                }else{
                    if(nOfBlocks.length == maximum){
                       if (myAccount == e.from) {
                        txList[e.hash] = [e.from, e.to, e.blockNumber];
                        accToSearch.push(e.to);
                        console.log("FIN. La lista de transacciones es:\n"+Object.values(txList)+"\n"+ "Y el conjunto de cuentas involucradas son:\n"+accToSearch);
                       }else{
                          console.log("FIN. La lista de transacciones es:\n"+Object.values(txList)+"\n"+ "Y el conjunto de cuentas involucradas son:\n"+accToSearch);
                       };
                    }else{
                      if (myAccount == e.from) {
                        txList[e.hash] = [e.from, e.to, e.blockNumber];
                        accToSearch.push(e.to);
                      };
                    };
                };
            });
          };
      });
  };
};


// Obtener el número del último bloque.
router.get('/getblocks', function (req, res){
  var start = 1001;
  var n = 1000;
  getNBlocks(start, n, function(blocks){
    console.log("El tercer elemento es " + JSON.stringify(blocks[2]));
  });
});

*/





//
// Busca el árbol para esa transacción.
router.get('/getTxTree', function (req, res){
  var tx = req.query.tx;
  txList.push(tx);
  getTxInfo(tx);
});

//Devuelve el número de bloque en el que se encuentra una transacción, así como sus wallets origen y destino.
function getTxInfo (tx){
  console.log(tx);
  web3.eth.getTransaction(tx, function (error, result){  
     //Variables globales wallets (array con las wallets) y txs (array con las transacciones), esta última se ha añadido ya antes de
     //llamar a esta función. 
     accToSearch.push(result.from);
     accToSearch.push(result.to);
     console.log("El bloque a buscar es " + result.blockNumber);
     startBlockNumber = result.blockNumber;
     bNumber = result.blockNumber;
     console.log(accToSearch.length);
     getNBlocks(startBlockNumber, n, processBlocks);
  });
};

//Devuelve un array con el bloque solicitado y los N-1 siguientes, ordenados.
function getNBlocks (start, n, callback){
  blocks = new Array(n);
  nOfBlocks = 0;
  var number = start;
  for (var i = start; i < (start+n); i++){
    web3.eth.getBlock(i, true, function(error, result){
      //Comprobamos que no estamos al final de la cadena
      nOfBlocks++;
      if( (result != null) && (result.number < (startBlockNumber+nOfBlocksToSearch) ) ){
        blocks[(result.number)-start] = result;
        console.log("nOfBlocks es " + nOfBlocks);
        if(nOfBlocks == n){
          console.log(blocks[n-1].number);
          startBlockNumber = startBlockNumber + n;
          callback(blocks);
        };
      }else{
        //SE PODRÍA AÑADIR UN BREAK O SIMILAR, AUNQUE NO HACE FALTA.
      };
    });
  };
};


//Devuelve un array con las transacciones que derivan de las que se pasan como parámetro.
function processBlocks(blocks){
  var pintar = false;
  var nOfBlocks = [];
  for (var i = 0; i < blocks.length; i++) {
    console.log("ESTAMOS BUSCANDO EL BLOQUE " + blocks[i].number);
        bNumber = blocks[i].number;
        if (blocks[i] != null && blocks[i].transactions != null) {
           blocks[i].transactions.forEach( function(e) {
              if(accToSearch.length > 0){
                  if(i == (n-1)){
                     if (accToSearch.includes(e.from)) {
                      //txList[e.hash] = [e.from, e.to, e.blockNumber];
                      txList.push(e.hash);
                      accToSearch.push(e.to);                      
                     }
                     
                     //Recursividad
                     if((accToSearch.length < (nodes)) && (bNumber < ((startBlockNumber + nOfBlocksToSearch)))){
                        getNBlocks(startBlockNumber, n, processBlocks);
                     }else{
                        pintar = true;
                     };
                  }else{
                    if (accToSearch.includes(e.from) && (accToSearch.length < (nodes))) {
                      //txList[e.hash] = [e.from, e.to, e.blockNumber];
                      txList.push(e.hash);
                      accToSearch.push(e.to);
                    };
                 }; 
              };
          });
           printTrans(pintar);
        };
  };
};

function printTrans(pintar){
  if(pintar){
    console.log("FIN. La lista de transacciones es:\n"+Object.values(txList)+"\n"+ "Y el conjunto de cuentas involucradas son:\n"+accToSearch);
    console.log("Hay " + txList.length + " transacciones y " + accToSearch.length + " cuentas");
  }
}











// NO SE USA

//Devuelve un array con el bloque solicitado y los N-1 siguientes. NO FUNCIONA POR EL WHILE.
function getNBlocks2 (start, n, callback){
  blocks = new Array(n);
  blocksCounter = 0;
  number = start;
  lastNumber = start-1;
  while(blocks.length < n){
    if(number == (start+n-1)){
      setTimeout(function(){console.log("Esperando")}, 2000);
    }
    if (number > lastNumber){
      console.log(blocks.length);
      web3.eth.getBlock(number, true, function(error, result){
        console.log(blocks.length);
        blocks.push(result);
      });
    };
    if(number < (start+(n-1))){
        number++;
    };
    lastNumber++;
  };
  callback(number);
  //console.log("El número de bloque inicial es: " + blocks[0].number + "\n" + "El número de bloque final es: " + blocks[n-1].number);
};
