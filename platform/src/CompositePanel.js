import { Panel } from "./Panel.js";
import { Layout } from "./Layout.js";

class CompositePanel extends Panel {
    childPanels = [];
    constructor(id = "composite") {
        super(id);
    }

    initialize(editor) {
        super.initialize(editor)
        this.childPanels.forEach(panel => {
            panel.initialize(editor);
            panel.parentComposite = this;
        });
    }

    /**
     * Check whether there are saveable changes to a child panels contents.
     * @override
     * @returns true if there are changes that can be saved.
     */
    canSave(){
        let childrenCanSave = false;

        this.childPanels.forEach( (cp) => childrenCanSave = childrenCanSave || cp.canSave() );

        return childrenCanSave;
    }

    /**
     * @override
     */
    save(fileHandler){
        let savePromises =  this.childPanels.map( (cp) => { 
            if (cp.canSave()) { 
                //save each child panel
                return cp.save(fileHandler); 
            } else { 
                return null; 
            }
        });
        return Promise.all(savePromises);
    }

    addPanel(panel) {
        this.childPanels.push(panel);
        panel.parentComposite = this; // Set a reference to the parent CompositePanel
    }

    removePanel(panel) {
        this.childPanels = this.childPanels.filter(p => p !== panel);
    }



    createElement() {
        var root = document.createElement("div");
        root.setAttribute("class", "compositePanel");
        root.setAttribute("data-role", "panel");
        root.setAttribute("id", this.id + "Panel");

        root.style.display = "flex";
        root.style.flexDirection = "column";
        root.style.flex = "1";

        var childElementList = []
        if (this.childPanels) {
            this.childPanels.forEach(childPanel => { 
                var childElement = childPanel.getElement();
                childElementList.push(childElement);
            });
        }
        const splitter = Layout.createHorizontalSplitter(childElementList);
        splitter.setAttribute("class", "h-100");

        root.appendChild(splitter);

        return root;
    }

    fit() {
        const panelElement = document.getElementById(this.id + "Panel");
        panelElement.firstChild.style.height = "100%";
        
        this.childPanels.forEach(panel => {
            panel.fit();
        });
    }
    
}

export { CompositePanel };
