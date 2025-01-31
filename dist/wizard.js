// wizard.ts
import blessed from 'blessed';
import { loadConfig, updateConfig } from './config.js';
export class ConfigProviderForm {
    constructor() {
        this.textboxes = new Map();
        this.textLabels = new Map();
        this.providers = [
            'OpenAI',
            'Gemini',
            'DeepSeek',
            'Ollama'
        ];
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'Commitah AI Provider Configuration'
        });
        this.form = blessed.form({
            parent: this.screen,
            width: '90%',
            height: '90%',
            top: 1,
            left: 'center',
            keys: true,
            vi: true
        });
        blessed.box({
            parent: this.form,
            top: 0,
            left: 2,
            right: 0,
            height: 1,
            content: 'Commitah AI Provider Configuration'
        });
        this.createRadioFields();
        this.createFields();
        this.createButton();
        this.setupKeys();
    }
    createRadioFields() {
        blessed.text({
            parent: this.form,
            top: 2,
            left: 2,
            content: 'Provider:',
            height: 1
        });
        this.radioset = blessed.radioset({
            parent: this.form,
            top: 2,
            left: 25,
            height: 6
        });
        let radioTop = 0;
        this.providers.forEach((provider, index) => {
            const radio = blessed.radiobutton({
                parent: this.radioset,
                top: radioTop,
                left: 0,
                height: 1,
                content: provider,
                checked: index === 0
            });
            radio.on('check', () => {
                this.updateFields(provider);
            });
            radioTop += 1;
        });
    }
    updateFields(provider) {
        const apiKeyLabel = this.textLabels.get('apiKey');
        const modelInput = this.textboxes.get('model');
        if (apiKeyLabel) {
            if (provider === 'Ollama') {
                apiKeyLabel.setContent('Ollama URL:');
            }
            else {
                apiKeyLabel.setContent(`${provider} API Key:`);
            }
        }
        if (modelInput) {
            switch (provider) {
                case 'OpenAI':
                    modelInput.setValue('gpt-4-turbo-preview');
                    break;
                case 'Gemini':
                    modelInput.setValue('gemini-1.5-flash');
                    break;
                case 'DeepSeek':
                    modelInput.setValue('deepseek-chat');
                    break;
                case 'Ollama':
                    modelInput.setValue('llama3.2');
                    break;
            }
        }
        this.screen.render();
    }
    createFields() {
        const currentConfig = loadConfig();
        let initialProvider = currentConfig.provider || 'OpenAI';
        let initialApiKeyLabel = `${initialProvider} API Key:`;
        let initialApiKeyValue = currentConfig.providerApiKey;
        if (currentConfig.provider === 'Ollama') {
            initialApiKeyLabel = `Ollama URL:`;
            initialApiKeyValue = currentConfig.providerUrl;
        }
        const radioButtons = this.radioset.children;
        radioButtons.forEach(radio => {
            if (radio.content === initialProvider) {
                radio.check();
            }
        });
        const fields = [
            {
                name: 'apiKey',
                label: initialApiKeyLabel,
                top: 8,
                value: initialApiKeyValue
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
        ];
        fields.forEach(field => {
            const textLabel = blessed.text({
                parent: this.form,
                top: field.top,
                left: 2,
                content: field.label,
                height: 1
            });
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
            });
            textbox.key('enter', () => {
                const nextField = this.getNextVisibleField(field.name);
                if (nextField) {
                    nextField.focus();
                }
                else {
                    this.submitButton.focus();
                }
            });
            this.textboxes.set(field.name, textbox);
            this.textLabels.set(field.name, textLabel);
        });
    }
    getNextVisibleField(currentFieldName) {
        const fields = Array.from(this.textboxes.entries());
        const currentIndex = fields.findIndex(([name]) => name === currentFieldName);
        for (let i = currentIndex + 1; i < fields.length; i++) {
            const [, field] = fields[i];
            if (!field.hidden) {
                return field;
            }
        }
        return null;
    }
    createButton() {
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
        });
        this.submitButton.key('enter', () => {
            let selectedProvider = '';
            const radios = this.radioset.children;
            radios.forEach((radio, index) => {
                if (radio.checked) {
                    selectedProvider = this.providers[index];
                }
            });
            const formData = {
                provider: selectedProvider,
                apiKey: this.textboxes.get('apiKey')?.value || '',
                model: this.textboxes.get('model')?.value || '',
                resultCount: this.textboxes.get('resultCount')?.value || '1'
            };
            const configUpdate = {
                model: formData.model,
                sizeOption: parseInt(formData.resultCount, 10) || 1,
                messageSpec: "conventional commit",
                provider: selectedProvider
            };
            if (formData.provider === 'Ollama') {
                configUpdate.providerUrl = formData.apiKey;
                configUpdate.providerApiKey = 'ollama';
            }
            else {
                let baseUrl = '';
                switch (formData.provider) {
                    case 'OpenAI':
                        baseUrl = 'https://api.openai.com/v1';
                        break;
                    case 'Gemini':
                        baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/';
                        break;
                    case 'DeepSeek':
                        baseUrl = 'https://api.deepseek.com/v1';
                        break;
                }
                configUpdate.providerUrl = baseUrl;
                configUpdate.providerApiKey = formData.apiKey;
            }
            updateConfig(configUpdate);
            this.screen.destroy();
            if (this.resolveForm) {
                this.resolveForm(true);
            }
        });
    }
    setupKeys() {
        this.screen.key(['escape', 'C-c'], () => {
            this.screen.destroy();
            if (this.resolveForm) {
                this.resolveForm(false);
            }
        });
        this.screen.key(['tab'], () => {
            const elements = [
                ...this.radioset.children,
                ...Array.from(this.textboxes.values()),
                this.submitButton
            ];
            const focused = this.screen.focused;
            const currentIndex = elements.indexOf(focused);
            const nextIndex = (currentIndex + 1) % elements.length;
            elements[nextIndex].focus();
        });
    }
    run() {
        return new Promise((resolve) => {
            this.resolveForm = resolve;
            const firstRadio = this.radioset.children[0];
            if (firstRadio) {
                firstRadio.focus();
            }
            this.screen.render();
        });
    }
    waitForKey(keys) {
        return new Promise((resolve) => {
            this.screen.key(keys, () => {
                resolve();
            });
        });
    }
}
