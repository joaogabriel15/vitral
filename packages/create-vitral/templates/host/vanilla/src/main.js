import 'vitral/auto'

document.getElementById('app').innerHTML = `
  <main>
    <h1>Host JS</h1>
    <vitral-remote src="__SRC__" props='{"nome":"host"}'></vitral-remote>
  </main>
`
