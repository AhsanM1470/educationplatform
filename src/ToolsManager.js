
class ToolManager {

    toolId;
    toolsUrl;
    tools = {};

    constructor(){

        var parameters = new URLSearchParams(window.location.search);
        
        //Retrive the tools url from platform url parameters
        if (parameters.has("tools")){
            this.toolsUrl = parameters.get("tools");

            var parameterKeys = Array.from(parameters.keys());
            
            this.fetchTools();

        } else {
            console.log("No tools URL parameter provided.")
        }

    }

    /*
     * Fetches the tools from the tools url and populates tool's
     * functions and panel definitions.
     */
    fetchTools(){
        var xhr = new XMLHttpRequest();
        xhr.open("GET", this.toolsUrl, false);
        xhr.send();

        if (xhr.status === 200) {    
            var json = JSON.parse(xhr.responseText);

            // Store the tools found in the given json
            for (const atool of json.tools) {

                if (atool.id){
                    this.storeTool(atool);
                    
                    //TODO update any tool mangement menu. 
                }
            }
        }

        
    }

    storeTool(newTool){
        // Add the tool
        this.tools[newTool.id] = newTool;
    }

    getToolIds(){
        return this.tools.keys();
    }


    getPanelDefinition(panelId) {

        for ( const toolskey of  Object.keys(this.tools)){

            const foundDefinition = this.tools[toolskey].panelDefs.find( pd => pd.id==panelId );

            if ( foundDefinition != undefined){
                return foundDefinition;
            } 
        } 
        
        console.log("Tool with panel definition id '" + panelId + "' was not found.");
        return null;
    }

    
    hasPanelDefinition(panelId){
        
        return (this.getPanelDefinition(panelId) != null);

    }

}

export {ToolManager};