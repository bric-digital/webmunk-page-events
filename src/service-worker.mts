// import { WebmunkClientModule, registerWebmunkModule } from '@bric/webmunk-core/browser'

// class PageEventsModule extends WebmunkClientModule {
//   constructor() {
//     super()
//   }

//   setup() {
//     console.log(`Setting up PageEventsModule...`)

//     document.addEventListener('freeze', (event) => {
//       console.log(`freeze`)
//     });

//     document.addEventListener('resume', (event) => {
//       console.log(`resume`)
//     });

//     document.addEventListener('visibilitychange', (event) => {
//       console.log(`visibilitychange`)
//     });

//     document.addEventListener('pageshow', (event) => {
//       console.log(`pageshow`)
//     });

//     document.addEventListener('pagehide', (event) => {
//       console.log(`pagehide`)
//     });

//     document.addEventListener('DOMContentLoaded', (event) => {
//       console.log(`DOMContentLoaded`)
//     });

//     document.addEventListener('readystatechange', (event) => {
//       console.log(`readystatechange`)
//     });

//     document.addEventListener('mousedown', (event) => {
//       console.log(`mousedown`)
//     });

//     document.addEventListener('mouseup', (event) => {
//       console.log(`mouseup`)
//     });
//   }
// }

// const plugin = new PageEventsModule()

// registerWebmunkModule(plugin)

export default {} // plugin
