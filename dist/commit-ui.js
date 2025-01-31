import blessed from 'blessed';
export class CommitSelector {
    constructor() {
        this.messages = [];
        this.ITEM_SPACING = 2;
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'Select Commit Message'
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
            top: 1,
            left: 2,
            right: 2,
            height: 1,
            content: 'Select Commit Message (↑↓ to select, Enter to check/submit)',
            style: {
                fg: 'white'
            }
        });
        this.radioset = blessed.radioset({
            parent: this.form,
            top: 4,
            left: 2,
            right: 2,
            height: 'shrink',
            style: {
                bg: 'default'
            },
        });
        this.setupKeys();
    }
    setupKeys() {
        this.screen.key(['escape', 'C-c'], () => {
            this.screen.destroy();
            if (this.resolveMessage) {
                this.resolveMessage(null);
            }
        });
        this.screen.key(['enter'], () => {
            const focused = this.screen.focused;
            const focusedContainer = this.radioset.children.find(container => container.children[0] === focused);
            const focusedIndex = this.radioset.children.indexOf(focusedContainer);
            if (focusedIndex === this.getSelectedIndex()) {
                this.screen.destroy();
                this.resolveMessage?.(this.messages[focusedIndex]);
            }
            else {
                this.radioset.children.forEach((container, idx) => {
                    container.children[0].checked = idx === focusedIndex;
                });
                this.screen.render();
            }
        });
    }
    showMessages(messages) {
        return new Promise((resolve) => {
            this.resolveMessage = resolve;
            this.messages = messages;
            this.radioset.children.forEach(child => child.destroy());
            messages.forEach((message, index) => {
                const container = blessed.box({
                    parent: this.radioset,
                    top: index * this.ITEM_SPACING,
                    left: 0,
                    height: this.ITEM_SPACING,
                    width: '100%-2'
                });
                const radio = blessed.radiobutton({
                    parent: container,
                    top: 0,
                    left: 0,
                    height: 1,
                    content: ' ' + message,
                    checked: index === 0,
                    mouse: true,
                    style: {
                        bg: 'default'
                    },
                });
                radio.on('click', () => {
                    const radios = this.radioset.children.map(container => container.children[0]);
                    radios.forEach((r, idx) => {
                        r.checked = r === radio;
                    });
                    this.screen.render();
                });
            });
            const firstRadio = (this.radioset.children[0].children[0]);
            if (firstRadio) {
                firstRadio.focus();
            }
            this.screen.render();
        });
    }
    getSelectedIndex() {
        return this.radioset.children.findIndex(container => container.children[0].checked);
    }
}
