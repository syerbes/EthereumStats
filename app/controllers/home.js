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

router.get('/lastBlock', function (req, res){
  
  web3.eth.getBlockNumber().then(console.log);
  
});

// Busca las transacciones en el bloque introducido y devuelve el hash de una
// al azar.
router.get('/searchBlock', function (req, res){
  var blockNumber = req.query.bnumber;
  var txlength = 0;
  var lastBlock = req.query.lb;

  //console.log('COMENZAMOS');
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
      getTxDetails(txHash, lastBlock);
   } else {
      if(result == null){
        console.log('El bloque aún no se ha creado.'); 
        return;
      }
      console.log('Ha habido algún problema: ', error); 
   };
  });
});

// Dado el hash de una transacción, obtiene las wallets origen y destino, junto con
// el número de bloque. Después, calcula el árbol de transacciones posteriores (desde la wallet
// destino, así como desde las wallets a las que esta wallet realiza transacciones). La búsqueda se
// interrumpe al alcanzar el quinto nivel en el árbol de transacciones o al trackear 100000.
function getTxDetails(tx, lastBlock){
  web3.eth.getTransaction(tx, function(error, result) {
    if (!error){
      console.log('Dirección origen: ' + result.from);
      console.log('Dirección destino: ' + result.to);
      console.log('El número de bloque es: ' + (result.blockNumber + 1));
      getTransactionsByAccount(result.to, result.blockNumber + 1, lastBlock, getTransactionsList);
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
  var newTx = iterar(myAccount, startBlockNumber, endBlockNumber);
  //seguir

};

function iterar(myAccount, startBlockNumber, endBlockNumber){
  var txToSearch = new Array();
  for (var i = startBlockNumber; i <= endBlockNumber; i++) {
      //console.log("startBlockNumber ES: " + startBlockNumber);
      web3.eth.getBlock(i, true, function(error, result){
          //console.log(result.number);
          //console.log(result.transactions);
          if (result != null && result.transactions != null) {
             result.transactions.forEach( function(e) {
                if (myAccount == e.from) { //myaccount == "*" || 
                    txToSearch.push(e);
                    console.log("  tx hash          : " + e.hash + "\n"
                     //+ "   nonce           : " + e.nonce + "\n"
                     //+ "   blockHash       : " + e.blockHash + "\n"
                     + "   blockNumber     : " + e.blockNumber + "\n"
                     //+ "   transactionIndex: " + e.transactionIndex + "\n"
                    + "   from            : " + e.from + "\n" 
                     //+ "   to              : " + e.to + "\n"
                      //+ "   value           : " + e.value + "\n"
                      //+ "   time            : " + block.timestamp + " " + new Date(block.timestamp * 1000).toGMTString() + "\n"
                    //+ "   gasPrice        : " + e.gasPrice + "\n"
                    //+ "   gas             : " + e.gas + "\n"
                   //+ "   input           : " + e.input);
                    )};
            });
          };
      });
  };
};
