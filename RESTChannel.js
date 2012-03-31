// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*globals window console */


// Don't use AMD here, it's too hard to sync the load events 

window.RESTChannel = (function() {

  var msgNumber = 0;
  var pending = {};

  function Connection() {
    this.sent = 0;
  }
  
  Connection.prototype = {
    serial: function(onOk, onErr) {
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
          body: obj,
          serial: serial(onOk, onErr)
      });
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

  var methods = [
    'response',
    'GET',
    'PUT',
    'POST',
    'DELETE'
  ];

  RESTChannel.prototype = {
  
    _badRequest: function(obj) {
      obj.status = 400;
      obj.reason = 'Bad Request';
      this.connection.putObject('response', obj); 
    },
    
    _notImplemented: function(obj) {
      obj.status = 501;
      obj.reason = "Not Implemented";
      this.connection.putObject('response', obj);
    },
    
    _preReply: function(obj) {
      return {
        url: obj.url,
        method: obj.method,
        serial: obj.serial
      };
    },
  
    _onmessage: function(event) {
      console.log('recv: ', event);
      debugger;
      
      var msgObj = this._validate(event);
      console.log('recv: ', msgObj);
      
      if (msgObj) {
        if (msgObj.url === 'response') {
          var callbacks = pending[msgObj.serial]; 
          if (callbacks) {
            var status = msgObj.status;
            if (status >= 200 && status < 300 && callbacks.ok) {
              callbacks.ok(msgObj);
            } else if (callbacks.err) {
              callbacks.err(msgObj);
            } else {
              console.error("RESTChannel response but no handlers", msgObj);
            }
          } else {
            console.error("RESTChannel response but no pending message", msgObj);
          }
        } else {
          var reply = this._preReply(msgObj);
          reply.response = this._dispatch(msgObj);
          this.connection.putObject('response', reply);
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
      var serial = msgObj.serial; 
      if (!serial) {
        return this._badRequest({message: 'No serial number'}); 
      } 
      var url = msgObj.url;
      if (!url) {
        return this._badRequest({message: 'No URL', serial: serial}); 
      }
      var method = msgObj.url; 
      if (!method || methods.indexOf(method) === -1) {
        return this._badRequest({
            message: 'Unknown Method', 
            method: method, 
            url: url, 
            serial: serial
        });
      }
      console.log('dispatch '+msgObj, msgObj);
      return msgObj;
    },
    
    _dispatch: function(msgObj) {
      var service = this.lookup(msgObj.url);
      var method = msgObj.method;
      if (!service || ! (method in service) ) {
        return this._notImplemented(msgObj);
      }
      return service[method](msgObj.body);
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