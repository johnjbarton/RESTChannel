// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*globals window console */


// Don't use AMD here, it's too hard to sync the load events 

window.RESTChannel = (function() {

  var debug = false;

  var msgNumber = 0;
  var pending = {};

  function Connection() {
    this.registry = {};
  }
  
  Connection.prototype = {
  
    serial: function(onOk, onErr) {
      if (!onOk || !onErr) {
        throw new Error("RESTChannel Connection: No response or error handler");
      }
      var serial = ++msgNumber;
      pending[serial] = {
        ok: onOk,
        err: onErr
      };
      return serial;
    },
  
    attach: function(port) {
      this.port = port;
      this.onAttach();
    },
    
    onAttach: function() {
      console.error('Not implemented');
    },
    
    close: function() {
      this.port.close(); 
    },
    
    // Commands to remote 
    //
    getObject: function(url, onOk, onErr) {
      this.port.postMessage({
          method: 'GET', 
          url: url, 
          serial: this.serial(onOk, onErr)
      });
    },
    
    putObject: function(url, obj, onOk, onErr) {
      this.port.postMessage({
          method: 'PUT', 
          url: url,
          body: obj,
          serial: this.serial(onOk, onErr)
      });
    },
    
    postObject: function(url, obj, onOk, onErr)  {
      this.port.postMessage({
          method: 'POST', 
          url: url,
          body: obj,
          serial: this.serial(onOk, onErr)
      });
    },
    
    deleteObject: function(url, onOk, onErr) {
      this.port.postMessage({
          method: 'DELETE', 
          url: url,
          serial: this.serial(onOk, onErr)
      });
    },
    
    respond: function(serial, obj) {
      this.port.postMessage({
          method: 'REPLY',
          url: '/',
          status: 200,
          serial: serial,
          body: obj
      });
    },
    
    // Commands from remote
    //
    register: function(url, handler) {
      this.registry[url] = handler;
    },
    
    dispatch: function(msgObj) {
      var service = this.registry[msgObj.url];
      var method = msgObj.method.toLowerCase();
      if (service && (method in service) ) {
        return service[method](msgObj.body);
      }
    }

  };

  function RESTChannel(port, connection) {
    this.connection = connection;
    port.onmessage = this._onmessage.bind(this);
    port.start();
    this.connection.attach(port);
  }

  var methods = [
    'REPLY',
    'GET',
    'PUT',
    'POST',
    'DELETE'
  ];

  RESTChannel.prototype = {
  
    _badRequest: function(obj) {
      obj.status = 400;
      obj.reason = 'Bad Request';
      this.connection.respond(obj);
      this.connection.close(); // you had your chance, you blew it.
    },
    
    _notImplemented: function(obj) {
      obj.status = 501;
      obj.reason = "Not Implemented";
      this.connection.respond(obj);
    },
    
    _envelop: function(obj) {
      return {
        url: obj.url,
        method: obj.method,
        serial: obj.serial
      };
    },
  
    _onmessage: function(event) {
      
      var msgObj = this._validate(event);
      if (debug) {
        console.log('recv: ', msgObj);
      }
     
      if (msgObj) {
        if (msgObj.method === 'REPLY') {
          var callbacks = pending[msgObj.serial]; 
          if (callbacks) {
            var status = msgObj.status;
            if (status >= 200 && status < 300 && callbacks.ok) {
              callbacks.ok(msgObj.body, msgObj);
            } else if (callbacks.err) {
              callbacks.err(msgObj);
            } else {
              console.error("RESTChannel response but no handlers", msgObj);
            }
          } else {
            console.error("RESTChannel response but no pending message", msgObj);
          }
        } else {
          var envelop = this._envelop(msgObj);
          var response = this.connection.dispatch(msgObj);
          if (response) {
            this.connection.respond(envelop.serial, response);
          } else {
            return this._notImplemented(envelop);
          }
        }
      }
    },
    
    _validate: function(event) {
      if (!event) {
        return this._badRequest({message: 'No event'}); 
      }
      var msgObj = event.data;
      if (!msgObj) {
        return this._badRequest({message: 'No event.data'}); 
      } 
      var method = msgObj.method; 
      if (!method || methods.indexOf(method) === -1) {
        return this._badRequest({
            message: 'Unknown Method', 
            method: method, 
            url: msgObj.url, 
            serial: msgObj.serial
        });
      }
      var serial = msgObj.serial; 
      if (!serial && method !== 'REPLY') {
        return this._badRequest({message: 'No serial number'}); 
      } 
      var url = msgObj.url;
      if (!url && method !== 'REPLY') {
        return this._badRequest({message: 'No URL', serial: serial}); 
      }
      if (debug) {
        console.log(msgObj.serial+' valid '+msgObj.method+' '+msgObj.url, msgObj);
      }
      return msgObj;
    }
    
  };

  function accept(connection, event) {
    if (event.data && event.data === "RESTChannel") {
      if (debug) {
        console.log(window.location + " RESTChannel accept ", event);
      }
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
    if (debug) {
      console.log('talk post');
    }
    listenerWindow.postMessage('RESTChannel', '*', [channel.port2]);
    return new RESTChannel(channel.port1, connection);
  }
  
  return {
    talk: talk,
    listen: listen,
    Connection: Connection
  };

}());