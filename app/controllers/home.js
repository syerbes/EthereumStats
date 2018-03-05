var Web3 = require('web3');
// Clave personal de acceso a la API. La web: https://infura.io
var APIKEY = "";

web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/' + APIKEY));

var express = require('express'),
  router = express.Router(),
  mongoose = require('mongoose'),
  Article = mongoose.model('Article');

module.exports = function (app) {
  app.use('/', router);
};

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
  web3.eth.getBlockNumber().then(console.log);
});

// Busca las transacciones en el bloque introducido y devuelve el hash de una
// al azar.
router.get('/searchBlock', function (req, res){
  var blockNumber = req.query.bnumber;
  var lastBlock = req.query.lb;
  getRandomTx(blockNumber, lastBlock, getTxDetails);
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
  iterar(myAccount, startBlockNumber, endBlockNumber, function(newTx){
      console.log("Las nuevas transacciones a buscar son: " + newTx);
  });
};

function iterar(myAccount, startBlockNumber, endBlockNumber, callback){
  var txList = {};
  var accToSearch = [];
  for (var i = startBlockNumber; i <= endBlockNumber; i++) {
      web3.eth.getBlock(i, true, function(error, result){
          //console.log(result.number);
          if (result != null && result.transactions != null) {
             result.transactions.forEach( function(e) {
                //problema
                if (myAccount == e.from || accToSearch.includes(e.from)) {
                  // añadimos la nueva cuenta destino en un array, para buscar también por esta
                    txList[e.hash] = [e.from, e.to, e.blockNumber];
                    accToSearch.push(e.to);
                    console.log("AQUI ESTAMOS" + e.to);
                };
            });
          };
      });
  };
  callback(txList);
};
