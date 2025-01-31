// wizard.ts
import blessed from 'blessed'
import { loadConfig, updateConfig } from './config.js'

interface FormData {
  provider: string
  apiKey: string
  model: string
  resultCount: string
}

type FocusableElement = blessed.Widgets.RadioButtonElement | blessed.Widgets.TextboxElement | blessed.Widgets.ButtonElement

export class ConfigProviderForm {
  screen: blessed.Widgets.Screen
  private form: blessed.Widgets.FormElement<FormData>
  private textboxes: Map<string, blessed.Widgets.TextboxElement> = new Map()
  private textLabels: Map<string, blessed.Widgets.TextElement> = new Map()
  private submitButton!: blessed.Widgets.ButtonElement
  private radioset!: blessed.Widgets.RadioSetElement
  private providers = [
    'OpenAI',
    'Gemini',
    'DeepSeek',
    'Ollama'
  ]
  private resolveForm?: (value: boolean) => void

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'AI Provider Configuration'
    })

    this.form = blessed.form<FormData>({
      parent: this.screen,
      width: '90%',
      height: '90%',
      top: 1,
      left: 'center',
      keys: true,
      vi: true
    }) as blessed.Widgets.FormElement<FormData>

    blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      content: 'AI Provider Configuration',
      style: {
        bg: 'blue',
        fg: 'white'
      }
    })

    this.createRadioFields()
    this.createFields()
    this.createButton()
    this.setupKeys()
  }

  private createRadioFields(): void {
    blessed.text({
      parent: this.form,
      top: 2,
      left: 2,
      content: 'Provider:',
      height: 1
    })

    this.radioset = blessed.radioset({
      parent: this.form,
      top: 2,
      left: 25,
      height: 6
    }) as blessed.Widgets.RadioSetElement

    let radioTop = 0
    this.providers.forEach((provider, index) => {
      const radio = blessed.radiobutton({
        parent: this.radioset,
        top: radioTop,
        left: 0,
        height: 1,
        content: provider,
        checked: index === 0
      })

      radio.on('check', () => {
        this.updateFields(provider)
      })

      radioTop += 1
    })
  }

  private updateFields(provider: string): void {
    const apiKeyLabel = this.textLabels.get('apiKey')
    const modelInput = this.textboxes.get('model')

    if (apiKeyLabel) {
      if (provider === 'Ollama') {
        apiKeyLabel.setContent('Ollama URL:')
      } else {
        apiKeyLabel.setContent(`${provider} API Key:`)
      }
    }

    if (modelInput) {
      switch (provider) {
        case 'OpenAI':
          modelInput.setValue('gpt-4-turbo-preview')
          break
        case 'Gemini':
          modelInput.setValue('gemini-pro')
          break
        case 'DeepSeek':
          modelInput.setValue('deepseek-chat')
          break
        case 'Ollama':
          modelInput.setValue('llama2')
          break
      }
    }

    this.screen.render()
  }

  private createFields(): void {
    const currentConfig = loadConfig()

    const fields = [
      {
        name: 'apiKey',
        label: 'OpenAI API Key:',
        top: 8,
        value: currentConfig.providerApiKey || ''
      },
      {
        name: 'model',
        label: 'Model:',
        value: currentConfig.model || 'gpt-4-turbo-preview',
        top: 10
      },
      {
        name: 'resultCount',
        label: 'Result Count:',
        value: currentConfig.sizeOption?.toString() || '1',
        top: 12
      }
    ]

    fields.forEach(field => {
      const textLabel = blessed.text({
        parent: this.form,
        top: field.top,
        left: 2,
        content: field.label,
        height: 1
      })

      const textbox = blessed.textbox({
        parent: this.form,
        name: field.name,
        top: field.top,
        left: 25,
        right: 2,
        height: 1,
        style: {
          focus: {
            bg: 'blue',
            fg: 'white'
          }
        },
        inputOnFocus: true,
        value: field.value
      }) as blessed.Widgets.TextboxElement

      textbox.key('enter', () => {
        const nextField = this.getNextVisibleField(field.name)
        if (nextField) {
          nextField.focus()
        } else {
          this.submitButton.focus()
        }
      })

      this.textboxes.set(field.name, textbox)
      this.textLabels.set(field.name, textLabel)
    })
  }

  private getNextVisibleField(currentFieldName: string): blessed.Widgets.TextboxElement | null {
    const fields = Array.from(this.textboxes.entries())
    const currentIndex = fields.findIndex(([name]) => name === currentFieldName)

    for (let i = currentIndex + 1; i < fields.length; i++) {
      const [, field] = fields[i]
      if (!field.hidden) {
        return field
      }
    }
    return null
  }

  private createButton(): void {
    this.submitButton = blessed.button({
      parent: this.form,
      bottom: 3,
      left: 'center',
      content: '[ Submit ]',
      style: {
        focus: {
          bg: 'blue',
          fg: 'white'
        }
      },
      height: 1,
      width: 12,
      mouse: true,
      keys: true,
      padding: {
        left: 1,
        right: 1
      }
    }) as blessed.Widgets.ButtonElement

    this.submitButton.key('enter', () => {
      let selectedProvider = ''
      const radios = this.radioset.children as blessed.Widgets.RadioButtonElement[]
      radios.forEach((radio, index) => {
        if (radio.checked) {
          selectedProvider = this.providers[index]
        }
      })

      const formData: FormData = {
        provider: selectedProvider,
        apiKey: this.textboxes.get('apiKey')?.value || '',
        model: this.textboxes.get('model')?.value || '',
        resultCount: this.textboxes.get('resultCount')?.value || '1'
      }

      const configUpdate: any = {
        model: formData.model,
        sizeOption: parseInt(formData.resultCount, 10) || 1,
        messageSpec: "conventional commit"
      }


      if (formData.provider === 'Ollama') {
        configUpdate.providerUrl = formData.apiKey + '/v1'
        configUpdate.providerApiKey = 'ollama'
      } else {
        let baseUrl = ''
        switch (formData.provider) {
          case 'OpenAI':
            baseUrl = 'https://api.openai.com/v1'
            break
          case 'Gemini':
            baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/'
            break
          case 'DeepSeek':
            baseUrl = 'https://api.deepseek.com/v1'
            break
        }

        configUpdate.providerUrl = baseUrl
        configUpdate.providerApiKey = formData.apiKey
      }

      updateConfig(configUpdate)

      this.screen.destroy()
      if (this.resolveForm) {
        this.resolveForm(true)
      }
    })
  }

  private setupKeys(): void {
    this.screen.key(['escape', 'C-c'], () => {
      this.screen.destroy()
      if (this.resolveForm) {
        this.resolveForm(false)
      }
    })

    this.screen.key(['tab'], () => {
      const elements: FocusableElement[] = [
        ...(this.radioset.children as blessed.Widgets.RadioButtonElement[]),
        ...Array.from(this.textboxes.values()),
        this.submitButton
      ]

      const focused = this.screen.focused as FocusableElement
      const currentIndex = elements.indexOf(focused)
      const nextIndex = (currentIndex + 1) % elements.length
      elements[nextIndex].focus()
    })
  }
  public run(): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolveForm = resolve
      const firstRadio = this.radioset.children[0] as blessed.Widgets.RadioButtonElement
      if (firstRadio) {
        firstRadio.focus()
      }
      this.screen.render()
    })
  }

  public waitForKey(
    keys: string[]
  ): Promise<void> {
    return new Promise((resolve) => {
      this.screen.key(keys, () => {
        resolve()
      })
    })
  }

}