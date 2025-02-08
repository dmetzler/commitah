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
    'Ollama',
    'Custom'
  ]
  private resolveForm?: (value: boolean) => void

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Commitah AI Provider Configuration'
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
      parent: this.form,
      top: 0,
      left: 2,
      right: 0,
      height: 1,
      content: 'Commitah AI Provider Configuration'
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
    const modelLabel = this.textLabels.get('model')
    const apiKeyField = this.textboxes.get('apiKey')
    const modelField = this.textboxes.get('model')
    const resultCountLabel = this.textLabels.get('resultCount')
    const resultCountField = this.textboxes.get('resultCount')

    const customUrlLabel = this.textLabels.get('customUrl')
    const customApiKeyLabel = this.textLabels.get('customApiKey')
    const customUrlField = this.textboxes.get('customUrl')
    const customApiKeyField = this.textboxes.get('customApiKey')

    // Toggle visibility based on provider
    if (provider === 'Custom') {
      // Hide standard apiKey field
      apiKeyLabel?.hide()
      apiKeyField?.hide()
      // Show custom fields
      customUrlLabel?.show()
      customApiKeyLabel?.show()
      customUrlField?.show()
      customApiKeyField?.show()
      // Keep model and result count visible
      modelLabel?.show()
      modelField?.show()
      resultCountLabel?.show()
      resultCountField?.show()
    } else {
      // Show standard fields
      apiKeyLabel?.show()
      apiKeyField?.show()
      modelLabel?.show()
      modelField?.show()
      resultCountLabel?.show()
      resultCountField?.show()
      // Hide custom fields
      customUrlLabel?.hide()
      customApiKeyLabel?.hide()
      customUrlField?.hide()
      customApiKeyField?.hide()

      if (apiKeyLabel) {
        apiKeyLabel.setContent(provider === 'Ollama' ? 'Ollama URL:' : `${provider} API Key:`)
      }
    }

    // Update model field for all providers
    if (modelField) {
      switch (provider) {
        case 'OpenAI':
          modelField.setValue('gpt-4-turbo-preview')
          break
        case 'Gemini':
          modelField.setValue('gemini-1.5-flash')
          break
        case 'DeepSeek':
          modelField.setValue('deepseek-chat')
          break
        case 'Ollama':
          modelField.setValue('llama3.2')
          break
        case 'Custom':
          // Keep existing value or clear it
          modelField.setValue(modelField.value || '')
          break
      }
    }

    this.screen.render()
  }

  private createFields(): void {
    const currentConfig = loadConfig()
    const initialProvider = currentConfig.provider || 'OpenAI'

    // Create standard fields with model field first
    const fields = [
      {
        name: 'model',
        label: 'Model:',
        value: currentConfig.model || '',
        top: 8
      },
      {
        name: 'apiKey',
        label: initialProvider === 'Ollama' ? 'Ollama URL:' : `${initialProvider} API Key:`,
        top: 10,
        value: initialProvider === 'Ollama' ? currentConfig.providerUrl : currentConfig.providerApiKey
      },
      {
        name: 'resultCount',
        label: 'Result count:',
        value: currentConfig.sizeOption?.toString() || '1',
        top: 14  // Moved down to accommodate custom fields
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
        value: field.value,

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

    // Add custom provider fields after model field
    const customFields = [
      {
        name: 'customUrl',
        label: 'Custom URL:',
        top: 10,
        value: currentConfig.provider === 'Custom' ? currentConfig.providerUrl : '',
      },
      {
        name: 'customApiKey',
        label: 'Custom API Key:',
        top: 12,
        value: currentConfig.provider === 'Custom' ? currentConfig.providerApiKey : '',
      }
    ]

    customFields.forEach(field => {
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
        value: field.value,
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

      // Initially hide custom fields if not Custom provider
      if (initialProvider !== 'Custom') {
        textLabel.hide()
        textbox.hide()
      }
    })

    // Initialize radio button state for Custom provider
    if (initialProvider === 'Custom') {
      const radioButtons = this.radioset.children as blessed.Widgets.RadioButtonElement[]
      radioButtons.forEach(radio => {
        if (radio.content === 'Custom') {
          radio.check()
        }
      })
      // Hide standard apiKey field
      this.textLabels.get('apiKey')?.hide()
      this.textboxes.get('apiKey')?.hide()
    }
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
        model: formData.model, // Model is always saved from the model field
        sizeOption: parseInt(formData.resultCount, 10) || 1,
        messageSpec: "conventional commit",
        provider: selectedProvider
      }

      if (formData.provider === 'Ollama') {
        configUpdate.providerUrl = formData.apiKey
        configUpdate.providerApiKey = 'ollama'
      } else if (formData.provider === 'Custom') {
        configUpdate.providerUrl = this.textboxes.get('customUrl')?.value || ''
        configUpdate.providerApiKey = this.textboxes.get('customApiKey')?.value || ''
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