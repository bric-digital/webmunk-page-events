import { REXClientModule, registerREXModule } from '@bric/rex-core/browser'

class PageEventsModule extends REXClientModule {
  constructor() {
    super()
  }

  toString():string {
    return 'PageEventsModule'
  }

  setup() {
    // console.log(`Setting up PageEventsModule...`)

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

registerREXModule(plugin)

export default plugin
