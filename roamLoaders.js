function loadDevScript(url='http://127.0.0.1:8080/index.js', id="devScript") {
  while (document.getElementById(id)) {
    document.getElementById(id).remove()
  }
  var devScript = document.createElement('script');
  devScript.type = "text/javascript";
  devScript.id = id;
  devScript.src =  url;
  document.head.appendChild(devScript);
}

function loadDevCSS(url='http://127.0.0.1:8080/index.css', id="devCSS") {
  var link  = document.createElement('link');
  link.id   = id;
  link.rel  = 'stylesheet';
  link.type = 'text/css';
  link.href = url;
  link.media = 'all';
  document.head.appendChild(link);
  while ( document.querySelectorAll(`#${id}`).length > 1) {
    document.querySelector(`#${id}`).remove()
  }
}

roamPromptLoader = {
    loadJS: () => loadDevScript('http://127.0.0.1:8080/roamPrompt.js'),
    loadCSS: () => loadDevCSS('http://127.0.0.1:8080/roamPrompt.css'),
    loadAll: function() {
      this.loadJS()
      this.loadCSS()
    },
    intervalIdJS: null,
    intervalIdCSS: null,
    getLiveStatus: function() {
        statusJS = this.intervalIdJS ? "LIVE" : "OFF"
        statusCSS = this.intervalIdCSS ? "LIVE" : "OFF"
        console.log(`JS: ${statusJS}, CSS: ${statusCSS}`)
    },
    startLiveJS: function () {
        this.intervalIdJS = setInterval(this.loadJS, 3000)
    },
    stopLiveJS: function () {
        clearInterval(this.intervalIdJS)
        this.intervalIdJS = null
    },
    startLiveCSS: function () {
        this.intervalIdCSS = setInterval(this.loadCSS, 3000)
    },
    stopLiveCSS: function () {
        clearInterval(this.intervalIdCSS)
        this.intervalIdCSS = null
    },
    startLiveAll: function () {
        this.startLiveJS()
        this.startLiveCSS()
    },
    stopLiveAll: function () {
        this.stopLiveJS()
        this.stopLiveCSS()
    }
}
