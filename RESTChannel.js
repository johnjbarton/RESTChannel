// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*globals window console */


// Don't use AMD here, it's too hard to sync the load events 

window.RESTChannel = (function() {

  function Connection() {
  }
  
  Connection.prototype = {
    attach: function(port) {
      this.port = port;
      this.onAttach();
    },
    onAttach: function() {
      console.error('Not implemented');
    },
    // Commands to remote 
    getObject: function(url) {
      this.port.postMessage({method: 'GET', url: url});
    },
    putObject: function(url, obj) {
      this.port.postMessage({method: 'PUT', url: url, body: obj});
    },
    postObject: function(url, obj)  {
      this.port.postMessage({method: 'POST', url: url, body: obj});
    },
    
    // Command from remote
    onGet: function(url) {
      this.putObject('response/'+url, {status: '501 Not Implemented'});
    },
    onPut: function(url, body) {
      this.putObject('response/'+url, {status: '501 Not Implemented'});
    },
    onPost: function(url, body) {
      this.putObject('response/'+url, {status: '501 Not Implemented'});
    }
  };

  function RESTChannel(port, connection) {
    this.connection = connection;
    port.onmessage = this._onmessage.bind(this);
    port.start();
    this.connection.attach(port);
  }

  RESTChannel.prototype = {
    _onmessage: function(event) {
      console.log('recv: ', event);
      if (!event) {
        this.connection.putObject('response', {status: '400 Bad Request', message: 'No event'}); 
      } else if (!event.data) {
        this.connection.putObject('response', {status: '400 Bad Request', message: 'No event.data'}); 
      } else {
        this._dispatch(event.data);
      }
    },
    
    _dispatch: function(msgObj) {
      console.log('dispatch '+msgObj, msgObj);
    }
  };

  function accept(connection, event) {
    if (event.data && event.data === "RESTChannel") {
      console.log(window.location + " RESTChannel accept ", event);
      var port = event.ports[0];
      return new RESTChannel(port, connection);
    } // else not for us
  }

  function listen(connection) {
    var onIntroduction = accept.bind(null, connection);
    window.addEventListener('message', onIntroduction);
    return function() {
      window.removeEventListener('message', onIntroduction);
    };
  }
  
  function talk(listenerWindow, connection) {
    var channel = new window.MessageChannel();
    channel.onmessage = accept.bind(null, connection);
    console.log('talk post');
    listenerWindow.postMessage('RESTChannel', '*', [channel.port2]);
    return new RESTChannel(channel.port1, connection);
  }
  
  return {
    talk: talk,
    listen: listen,
    Connection: Connection
  };

}());