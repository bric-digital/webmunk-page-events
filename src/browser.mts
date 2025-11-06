import { WebmunkClientModule, registerWebmunkModule } from '@bric/webmunk-core/browser'

class PageEventsModule extends WebmunkClientModule {
  constructor() {
    super()
  }

  setup() {
    console.log(`Setting up PageEventsModule...`)

    document.addEventListener('freeze', (event) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log(`freeze`)
    });

    document.addEventListener('resume', (event) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log(`resume`)
    });

    document.addEventListener('visibilitychange', (event) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log(`visibilitychange`)
    });

    document.addEventListener('pageshow', (event) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log(`pageshow`)
    });

    document.addEventListener('pagehide', (event) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log(`pagehide`)
    });

    document.addEventListener('DOMContentLoaded', (event) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log(`DOMContentLoaded`)
    });

    document.addEventListener('readystatechange', (event) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log(`readystatechange`)
    });

    document.addEventListener('mousedown', (event) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log(`mousedown`)
    });

    document.addEventListener('mouseup', (event) => { // eslint-disable-line @typescript-eslint/no-unused-vars
      console.log(`mouseup`)
    });
  }
}

const plugin = new PageEventsModule()

registerWebmunkModule(plugin)

export default plugin
