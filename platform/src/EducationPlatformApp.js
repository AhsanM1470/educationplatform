/*global $ -- jquery is externally imported*/
/*global FEEDBACK_SURVEY_URL -- is set by environment variable*/
/*global Metro -- Metro is externally imported*/

import * as ace from 'ace-builds/src-min-noconflict/ace';
import 'ace-builds/src-min-noconflict/theme-eclipse';
import 'ace-builds/src-min-noconflict/mode-xml';
import 'ace-builds/src-min-noconflict/mode-yaml';
import 'ace-builds/src-min-noconflict/mode-java';
import 'ace-builds/src-min-noconflict/mode-html';
import 'ace-builds/src-min-noconflict/ext-modelist';
import 'ace-builds/src-min-noconflict/ext-language_tools';

import 'metro4/build/metro';

import { FileHandler } from './FileHandler.js';
import { ActivityManager } from './ActivityManager.js';
import { ToolManager as ToolsManager } from './ToolsManager.js';
import { EducationPlatformError } from './EducationPlatformError.js'
import { ConfigValidationError } from './ConfigValidationError.js';
import { ActivityValidator } from './ActivityValidator.js';

import { ConsolePanel } from "./ConsolePanel.js";
import { ProgramPanel } from "./ProgramPanel.js";
import { OutputPanel } from "./OutputPanel.js";
import { TestPanel } from './TestPanel.js';
import { BlankPanel } from './BlankPanel .js';
import { XtextEditorPanel } from './XtextEditorPanel.js';
import { CompositePanel } from './CompositePanel.js';
import { Button } from './Button.js';

import { Preloader } from './Preloader.js';
import { Layout } from './Layout.js';
import { PlaygroundUtility } from './PlaygroundUtility.js';
import { jsonRequest, jsonRequestConversion, ARRAY_ANY_ELEMENT, urlParamPrivateRepo, utility } from './Utility.js';


const COMMON_UTILITY_URL = utility.getWindowLocationHref().replace( utility.getWindowLocationSearch(), "" ) + "common/utility.json";

class EducationPlatformApp {
    outputType;
    outputLanguage;
    activity;
    preloader;
    panels;

    fileHandler;
    activityManager;
    toolsManager;

    constructor() {
        this.outputType = "text";
        this.outputLanguage = "text";
        this.preloader = new Preloader();
        this.panels = [];
    }

    initialize( urlParameters, tokenHandlerUrl ){
        this.fileHandler = new FileHandler(tokenHandlerUrl);

        /* 
        *  Setup the browser environment 
        */
        if (FEEDBACK_SURVEY_URL){
            PlaygroundUtility.setFeedbackButtonUrl(FEEDBACK_SURVEY_URL);
            PlaygroundUtility.showFeedbackButton();
        }

        document.getElementById("btnnologin").onclick= () => {

            PlaygroundUtility.hideLogin();
        }


        if (!urlParamPrivateRepo()){
            // Public repo so no need to authenticate
            this.initializeActivity(urlParameters);
            
        } else {
            PlaygroundUtility.showLogin();
        }

        document.getElementById("btnlogin").onclick= async () => {

            // Get github url
            const urlRequest = { url: utility.getWindowLocationHref() };
            let authServerDetails= await jsonRequest(tokenHandlerUrl + "/mdenet-auth/login/url",
                                                    JSON.stringify(urlRequest) );

            

            authServerDetails = JSON.parse(authServerDetails);

            // Authenticate redirect 
            utility.setWindowLocationHref(authServerDetails.url);
        }

        if (urlParameters.has("code") && urlParameters.has("state")  ){
            // Returning from authentication redirect
            PlaygroundUtility.hideLogin();

            //Complete authentication
            const tokenRequest = {};
            tokenRequest.state = urlParameters.get("state");
            tokenRequest.code = urlParameters.get("code");

            //TODO loading box
            let authDetails = jsonRequest(tokenHandlerUrl + "/mdenet-auth/login/token",
                                        JSON.stringify(tokenRequest), true );
            authDetails.then( () => {
                document.getElementById('save')?.classList.remove('hidden');
                window.sessionStorage.setItem("isAuthenticated", true);
                this.initializeActivity(urlParameters);
            } );
        }

        // Clean authentication parameters from url
        urlParameters.delete("code");
        urlParameters.delete("state");


        // Encode ':' and '/' with toString
        // Skips the default encoding to so that the URL can be reused
        let params = [];
        for (const [key, value] of urlParameters) {
        // For a specific key ('activities' in this case), you add it to the array without encoding
        if (key === 'activities') {
            params.push(`${key}=${value}`);
        } else {
            // For all other parameters, you still want to encode them
            params.push(`${key}=${encodeURIComponent(value)}`);
        }
        }
        // Now join all the parameters with '&' to form the query string
        let queryString = params.join('&');

        // Use replaceState to update the URL without encoding the parameter
        window.history.replaceState({}, document.title, "?" + queryString);
    }



    initializeActivity(urlParameters){

        let errors = [];

        if (!urlParameters.has("activities")) {
            // No activity configuration has been given
            errors.push(new EducationPlatformError("No activity configuration has been specified."));
        }

        if (errors.length==0){
            // An activity configuration has been provided
            this.toolsManager = new ToolsManager();
            this.activityManager = new ActivityManager( (this.toolsManager.getPanelDefinition).bind(this.toolsManager), this.fileHandler );
            this.activityManager.initializeActivities();
            errors = errors.concat(this.activityManager.getConfigErrors());
        } 

        if (errors.length==0){
            // The activities have been validated
            this.toolsManager.setToolsUrls( this.activityManager.getToolUrls().add(COMMON_UTILITY_URL) );
            errors = errors.concat(this.toolsManager.getConfigErrors());
        }

        if (errors.length==0){
            // The tools have been validated 
            this.activityManager.showActivitiesNavEntries();

            // Import tool grammar highlighting 
            const  toolImports = this.toolsManager.getToolsGrammarImports(); 

            for(let ipt of toolImports) {
                ace.config.setModuleUrl(ipt.module, ipt.url);
            }

            // Add Tool styles for icons 
            for (let toolUrl of this.activityManager.getToolUrls()){
                let toolBaseUrl = toolUrl.substring(0, toolUrl.lastIndexOf("/"));
                var link = document.createElement("link");
                link.setAttribute("rel", 'stylesheet');
                link.setAttribute("href", toolBaseUrl + "/icons.css");
                document.head.appendChild(link);
            }
            
            this.activity = this.activityManager.getSelectedActivity(); 

            // Validate the resolved activity
            errors = errors.concat( ActivityValidator.validate(this.activity, this.toolsManager.tools) );   
        }

        if  (errors.length==0){
            // The resolved activity has been validated
            this.initializePanels();
        }

        if (errors.length > 0) {
            this.displayErrors(errors);
        }
    }

    displayErrors(errors){

            const contentPanelName = "content-panel";
        
            this.panels.push(new BlankPanel(contentPanelName));
            this.panels[0].setVisible(true);
        
            new Layout().createFromPanels("navview-content", this.panels);
        
            PlaygroundUtility.showMenu();
        
            Metro.init();
            this.fit();
        
            var contentPanelDiv = document.getElementById(contentPanelName);

            // EP Errors
            const platformErrors= errors.filter((e)=> e.constructor.name === EducationPlatformError.name);

            if (platformErrors.length > 0){
                let contentTitle = document.createElement("h2");
                contentTitle.innerText = "Education Platform Errors:";
                contentPanelDiv.append(contentTitle);

                platformErrors.forEach( (err) => {
                    let content = document.createElement("p");
                    content.append(document.createTextNode(err.message));

                    contentPanelDiv.append(content);
                });

                contentPanelDiv.append(document.createElement("p"));
            }

            // Config File Errors
            const configErrors= errors.filter((e)=> e.constructor.name === ConfigValidationError.name);

            if(configErrors.length > 0){
                let contentTitle = document.createElement("h2");
                contentTitle.innerText = "Config File Errors:";
                contentPanelDiv.append(contentTitle);

                let contentLabels = document.createElement("b");
                contentLabels.innerText = "File | Category | Details | Location";
                contentPanelDiv.append(contentLabels);

                configErrors.forEach( (err) => {
                    let content = document.createElement("p");
                    let contentText= `${err.fileType} | ${err.category} | ${err.message} | ${err.location}` ;
                    content.append(document.createTextNode(contentText));

                    contentPanelDiv.append(content);
                });
            }

            const otherErrors = errors.filter((e) => !(configErrors.includes(e) || platformErrors.includes(e)))
            if (otherErrors.length > 0) {
                let contentTitle = document.createElement("h2");
                contentTitle.innerText = "Errors:";
                contentPanelDiv.append(contentTitle);

                otherErrors.forEach( (err) => {
                    let content = document.createElement("p");
                    let contentText= `${err.constructor.name}: ${err.message}` ;
                    content.append(document.createTextNode(contentText));

                    contentPanelDiv.append(content);
                });
            }
    }

    initializePanels() {
        
        if (this.activity.outputLanguage != null) {
            this.outputLanguage = this.activity.outputLanguage;
        }
        
        // Create panels for the given activities
        for ( let apanel of this.activity.panels ){

            var newPanel = this.createPanelForDefinitionId(apanel);
            if (newPanel != null){
                this.panels.push(newPanel);
            }
        }    


        new Layout().createFrom2dArray("navview-content", this.panels, this.activity.layout.area);


        PlaygroundUtility.showMenu();
        
        document.addEventListener('click', function(evt) {
            if (evt.target == document.getElementById("toggleNavViewPane")) {
                setTimeout(function(){ this.fit(); }, 1000);
            }
        });

        Metro.init();

        this.activityManager.openActiveActivitiesSubMenu();
        
        this.fit();
    }


    /**
     * Create a panel for a given panel config entry
     * 
     * @param {Object} panel - The activity config panel definition.
     * @return {Panel} the platform Panel
     */
    createPanelForDefinitionId(panel){
        const panelDefinition = panel.ref;
        var newPanel = null;

        const newPanelId= panel.id;

        if (panelDefinition != null){

            switch(panelDefinition.panelclass) {
                case "ProgramPanel": {
                    newPanel =  new ProgramPanel(newPanelId);
                    newPanel.initialize();
                    
                    // Set from the tool panel definition  
                    newPanel.setEditorMode(panelDefinition.language);

                    newPanel.setType(panelDefinition.language);

                    // Set from the activity 
                    newPanel.setValue(panel.file);
                    newPanel.setValueSha(panel.sha); 
                    newPanel.setFileUrl(panel.url);
                    break;
                }
                case "ConsolePanel": {
                    newPanel =  new ConsolePanel(newPanelId);
                    newPanel.initialize();
                    break;
                }
                case "OutputPanel": {
                    newPanel =  new OutputPanel(newPanelId, panelDefinition.language, this.outputType, this.outputLanguage);
                    newPanel.initialize();
                    break;
                }
                case "XtextEditorPanel": {
                    let editorUrl = sessionStorage.getItem(newPanelId);
                    
                    newPanel = new XtextEditorPanel(newPanelId);
                    newPanel.initialize(editorUrl, panel.extension);
                    newPanel.setType(panelDefinition.language);

                    // Set from the activity 
                    newPanel.setValue(panel.file);
                    newPanel.setValueSha(panel.sha); 
                    newPanel.setFileUrl(panel.url)

                    break;
                }
                case "CompositePanel": {

                    newPanel = new CompositePanel(newPanelId);
                    if (panel.childPanels) {
                        for (let childPanelConfig of panel.childPanels) {     
                            var childPanel = this.createPanelForDefinitionId(childPanelConfig);
                            newPanel.addPanel(childPanel);
                        }
                    }
                    newPanel.initialize();
                    
                    break;
                }
                // TODO create other panel types e.g. models and metamodels so the text is formatted correctly
                default: {
                    newPanel = new TestPanel(newPanelId);    
                }            
            }
        
            // Add elements common to all panels
            newPanel.setTitle(panel.name);

            if(panel.icon != null){
                newPanel.setIcon(panel.icon);
            } else {
                newPanel.setIcon(panelDefinition.icon);
            }
            
            if (panel.buttons == null && panelDefinition.buttons != null){
                // No activity defined buttons
                newPanel.addButtons( Button.createButtons( panelDefinition.buttons, panel.id));

            } else if (panel.buttons != null) {
                // The activity has defined the buttons, some may be references to buttons defined in the tool spec
                let resolvedButtonConfigs = panel.buttons.map(btn =>{    
                    let resolvedButton;

                    if (btn.ref){
                        if (panelDefinition.buttons != null) {
                            // button reference so resolve
                            resolvedButton = panelDefinition.buttons.find((pdBtn)=> pdBtn.id===btn.ref);
                        }
                    } else {
                        // activity defined button
                        resolvedButton = btn;
                    }
                    return resolvedButton;
                });
                panel.buttons = resolvedButtonConfigs;
                newPanel.addButtons( Button.createButtons( resolvedButtonConfigs, panel.id));
            }
        }
        return newPanel;
    }


    getPanelTitle(panelId) {
        return $("#" + panelId)[0].dataset.titleCaption;
    }

    /**
     * Invokes an action function by placing requests to all the required external tool functions  
     * 
     *  TODO: To be moved to the ToolManager issue #40
     * 
     * @param {string} functionId the id of tool function
     * @param {Map} parameterMap map from parameter name to its value and type
     * @returns {Promise}  promise to result of the action function 
     */
    invokeActionFunction(functionId, parameterMap){

        let actionFunction = this.toolsManager.functionRegistry_resolve(functionId);

        let parameterPromises = [];

        for ( const paramName  of parameterMap.keys() ){ /* TODO add defensive checks that every required value
                                                                is provided issue #57 */

            let actionFunctionParam = actionFunction.getParameters().find( p => p.name === paramName);                                                             
                                                                        
            /* Check the given parameter types against the those of the requested action function. 
            If required, request conversion from available tool functions */
            let givenParameter = parameterMap.get(paramName);

            if (givenParameter.type != actionFunctionParam.type){
                //Types don't match  so try  and convert 
                let convertedValue;

                const metamodelId = actionFunction.getInstanceOfParamName(paramName);
                
                if(metamodelId==null){
                    // Convert with no metamodel to consider
                    convertedValue = this.convert( givenParameter.value, givenParameter.type, 
                                            actionFunctionParam.type, paramName ); // TODO issue #58 remove paramName

                } else {
                    // Convert considering metamodel
                    const givenMetamodel = parameterMap.get(metamodelId);

                    convertedValue = this.convertIncludingMetamodel( givenParameter.value , givenParameter.type, 
                                                                givenMetamodel.value, givenMetamodel.type, 
                                                                actionFunctionParam.type, paramName ); // TODO issue #58 remove paramName
                }

                parameterPromises.push(convertedValue);
            
            } else {
                // Matching types add values to promise for synchronisation 
                let value =  new Promise( function (resolve) { 
                    let parameterData = {};
                    
                    parameterData.name = paramName;
                    parameterData.data = givenParameter.value;
        
                    resolve(parameterData); 
                });

                parameterPromises.push(value);
            }
        }

        // Invoke the actionFunction on completion of any conversions
        let actionFunctionPromise = new Promise( (resolve, reject) => {

            Promise.all( parameterPromises ).then( (values) => { 
                let actionRequestData = {};

                //Populate the transformed parameters
                for ( const param  of actionFunction.getParameters() ){

                    const panelConfig = parameterMap.get(param.name); 

                    if (panelConfig != undefined){
                        let parameterData = values.find(val => (val.name === param.name) );

                        actionRequestData[param.name] =  parameterData.data;
                    }
                }

                let resultPromise = this.functionRegistry_call(functionId, actionRequestData);

                resolve(resultPromise);
            
            }).catch( (err) => {

                reject(err);
            });

        });

        return actionFunctionPromise;
    }



    /**
     * Converts a source value to a target type using the available conversion functions
     * 
     *   TODO: To be moved to the ToolManager issue #40
     * 
     * @param {string} sourceValue 
     * @param {string} sourceType 
     * @param {string} targetType
     * @param {string} parameterName name of the parameter for request
     * @returns {Promise} promise for the converted parameter value
     */
    convert(sourceValue, sourceType, targetType, parameterName){
        
        let parameterPromise;
        let typesPanelValuesMap = {}; // Types have to be distinct for mapping to the conversion function's parameters
        typesPanelValuesMap[sourceType]=  sourceValue;

        let conversionFunctionId = this.functionRegistry_find( Object.keys(typesPanelValuesMap), targetType );

        if (conversionFunctionId != null){
            //There is a matching conversion function
            parameterPromise = this.functionRegistry_callConversion(conversionFunctionId, typesPanelValuesMap, parameterName);
            
        } else {
            parameterPromise = null;
            this.errorNotification("No conversion function available for input types:" + Object.keys(typesPanelValuesMap).toString() )
        }

        return parameterPromise;
    }


    /**
     * Converts a source value to a target type using the available conversion functions taking
     * into consideration the related metamodel.
     * 
     *   TODO: To be moved to the ToolManager issue #40
     * 
     * @param {string} sourceValue 
     * @param {string} sourceType
     * @param {string} metamodelValue 
     * @param {string} metamodelType
     * @param {string} targetType
     * @param {string} parameterName name of the parameter for request
     * @returns {Promise} promise for the converted parameter value
     */
    async convertIncludingMetamodel(sourceValue, sourceType, metamodelValue, metamodelType, targetType, parameterName){
        let parameterPromise;
        let typesPanelValuesMap = {}; // Types have to be distinct for mapping to the conversion function's parameters
        typesPanelValuesMap[sourceType]=  sourceValue;

        let conversionFunctionId;

        let potentialConversionFunctions = this.functionRegistry_findPartial( [sourceType, ARRAY_ANY_ELEMENT], targetType);

        //check for a conversion function with the metamodel type
        conversionFunctionId = await this.selectConversionFunctionConvertMetamodel( metamodelType, metamodelValue, potentialConversionFunctions, 
                                                                                false, parameterName, typesPanelValuesMap)

        if (conversionFunctionId==null){
            //no conversion found so check for a conversion function but consider conversions of the metamodel
            conversionFunctionId = await this.selectConversionFunctionConvertMetamodel(metamodelType, metamodelValue, potentialConversionFunctions, 
                                                                                    true, parameterName, typesPanelValuesMap);
        }

        if (conversionFunctionId != null){
            //There is a matching conversion function
            parameterPromise = this.functionRegistry_callConversion(conversionFunctionId, typesPanelValuesMap, parameterName);
            
        } else {
            parameterPromise = null;
            this.errorNotification("No conversion function available for input types:" + Object.keys(typesPanelValuesMap).toString() )
        }

        return parameterPromise;
    }


    /**
     * For the given list of conversion function ids to check, finds the first conversion function with matching metamodel dependency.
     * Optionally conversions of the metamodel are considered from the conversion functions available to the tools manager and
     * the metamodel type. If available, the metamodel value is converted to the required type. 
     * 
     * @param {string} metamodelType the metamodel type
     * @param {string} metamodelValue the metamodel value
     * @param {string[]} conversionFunctions list of conversion function ids to check 
     * @param {boolean} convertMetamodel when true try to convert the metamodel using a remote tool service conversion function
     *                                    available to the ToolsManager.
     * @param {string} parameterName the name of the parameter to use when converting the metamodel. 
     * @param {string[]} typeValueMap the type values map the metamodel input value is added to if a conversion function is found
     * @returns {string} the id of a conversion function to use, null if none found.
     */
    async selectConversionFunctionConvertMetamodel(metamodelType, metamodelValue, conversionFunctions, convertMetamodel, parameterName, typeValueMap){
        let conversionFunctionId = null;
        let functionsToCheck = [];

        if (Array.isArray(conversionFunctions)){
            functionsToCheck = [...conversionFunctions];
        }
        
        while ( conversionFunctionId==null && functionsToCheck.length > 0){
            let functionId = functionsToCheck.pop();
            let conversionFunction = this.toolsManager.getActionFunction(functionId);

            // Lookup the conversion function's metamodel type
            let metamodelName = conversionFunction.getInstanceOfParamName( conversionFunction.getParameters()[0].name );

            if(metamodelName==null){
                metamodelName = conversionFunction.getInstanceOfParamName( conversionFunction.getParameters()[1].name );
            }

            const targetMetamodelType = conversionFunction.getParameterType(metamodelName);

            if (!convertMetamodel){
                // Check for conversion functions with matching metamodels only
                
                if (targetMetamodelType==metamodelType) {
                        //Conversion function found so use the panel value
                        
                        conversionFunctionId = functionId;
                        typeValueMap[metamodelType]=  metamodelValue;
                }

            } else {
                // Check for conversion functions converting metamodel if possible 
                let metamodelConversionFunctionId = this.toolsManager.getConversionFunction( [metamodelType], targetMetamodelType );
                
                if (metamodelConversionFunctionId != null){

                    conversionFunctionId = functionId;

                    //convert metamodel
                    let metamodelTypeValueMap =  {};  
                    metamodelTypeValueMap[metamodelType]=metamodelValue; // The found conversion function is expected to have one parameter

                    let convertedValue = await this.functionRegistry_callConversion(metamodelConversionFunctionId, metamodelTypeValueMap, parameterName);

                    typeValueMap[targetMetamodelType]= convertedValue.data;
                }
            }
        }

        return conversionFunctionId;
    }

    /**
     * Prepares the input parameters and requests the type translation for the given function id  
     * 
     *   TODO: To be moved to the FunctionRegistry issue #40
     * 
     * @param {string} functionId the id of the action function
     * @param {Object} typeValuesMap an object mapping action functions parameter types as keys to input values
     * @param {string} parameterName name of the parameter
     * @returns Promise for the translated data
     * 
     */
    functionRegistry_callConversion( functionId, typeValuesMap, parameterName ){
        let conversionRequestData = {};
        let conversionFunction = this.toolsManager.getActionFunction(functionId);

        // Populate parameters for the conversion request 
        for( const param of conversionFunction.getParameters() ){
            conversionRequestData[param.name] =  typeValuesMap[param.type];
        }

        return this.requestTranslation(conversionRequestData, conversionFunction, parameterName);
    }

    /**
     * 
     * @param {string} functionId url of the function to call
     * @param {Object} parameters object containing the parameters request data
     * @returns 
     */
    functionRegistry_call(functionId, parameters ){

        let actionFunction = this.toolsManager.getActionFunction(functionId);
        let parametersJson = JSON.stringify(parameters);

        let requestPromise = jsonRequest(actionFunction.getPath(), parametersJson)

        return requestPromise;
    }


    /**
     * Requests the conversion function from the remote tool service
     * 
     * @param {Object} parameters 
     * @param {ActionFunction} conversionFunction
     * @param {String} parameterName name of the parameter
     * @returns Promise for the translated data
     */
    requestTranslation(parameters, conversionFunction, parameterName){
        
        let parametersJson = JSON.stringify(parameters);

        return jsonRequestConversion(conversionFunction.getPath(), parametersJson, parameterName);
    }

    /**
     *   TODO: Temporary wrapper called function to be renamed and to be moved to the FunctionRegistry issue #40 
     */
    functionRegistry_find(inputsParamTypes, outputParamType){
        return this.toolsManager.getConversionFunction( inputsParamTypes, outputParamType );
    }

    /**
     *   TODO: Temporary wrapper called function to be renamed and to be moved to the FunctionRegistry issue #40 
     */
    functionRegistry_findPartial(inputsParamTypes, outputParamType){
        return this.toolsManager.getPartiallyMatchingConversionFunctions( inputsParamTypes, outputParamType );
    }



    /**
     * Handle the response from the remote tool service
     * 
     * @param {Object} action 
     * @param {Promise} requestPromise
     */
    handleResponseActionFunction(action, requestPromise){
        
        requestPromise.then( (responseText) => {

            var response = JSON.parse(responseText);
            const outputPanel = this.activityManager.findPanel( action.output.id, this.panels);

            var outputConsole;
            if (action.outputConsole != null){
                outputConsole = this.activityManager.findPanel(action.outputConsole.id, this.panels);
            } else {
                outputConsole = outputPanel;
            }

            Metro.notify.killAll();

            if ( Object.prototype.hasOwnProperty.call(response, "error")) {
                outputConsole.setError(response.error);
            } else {

                var responseDiagram = Object.keys(response).find( key => key.toLowerCase().includes("diagram") );

                if (response.output) {
                    // Text
                    outputConsole.setValue(response.output)  
                }
                
                if (response.editorUrl) {
                    // Language workbench
                    this.longNotification("Building editor");
                    this.checkEditorReady( response.editorStatusUrl, response.editorUrl, action.source.editorPanel, action.source.editorActivity, outputConsole);
                    

                } else if (responseDiagram != undefined) {
                
                    outputPanel.renderDiagram( response[responseDiagram] );
                    
                } else if (response.generatedFiles) {
                    // Multiple text files
                    outputPanel.setGeneratedFiles(response.generatedFiles);

                } else if (response.generatedText) {
                    // Generated file

                    switch (action.outputType){
                        case "code":
                            // Text
                            outputPanel.getEditor().setValue(response.generatedText.trim(), 1);
                            break;

                        case "html":
                            // Html
                            outputPanel.setOutput(response.output);
                            var iframe = document.getElementById("htmlIframe");
                            if (iframe == null) {
                                iframe = document.createElement("iframe");
                                iframe.id = "htmlIframe"
                                iframe.style.height = "100%";
                                iframe.style.width = "100%";
                                document.getElementById(outputPanel.getId() + "Diagram").appendChild(iframe);
                            }
                            
                            iframe.srcdoc = response.generatedText;
                            break; 

                        case "puml": 
                        case "dot":
                            // UML or Graph
                            var krokiEndpoint = "";
                            if (action.outputType == "puml") krokiEndpoint = "plantuml";
                            else krokiEndpoint = "graphviz/svg"

                            var krokiXhr = new XMLHttpRequest();
                            krokiXhr.open("POST", "https://kroki.io/" + krokiEndpoint, true);
                            krokiXhr.setRequestHeader("Accept", "image/svg+xml");
                            krokiXhr.setRequestHeader("Content-Type", "text/plain");
                            krokiXhr.onreadystatechange = function () {
                                if (krokiXhr.readyState === 4) {
                                    if (krokiXhr.status === 200) {

                                        outputPanel.renderDiagram(krokiXhr.responseText);

                                    }
                                }
                            };
                            krokiXhr.send(response.generatedText);
                            break;

                            default:
                                console.log("Unknown output type: " + action.outputType);
                    }
                }

            }
        });

    }


    fit() {
        
        var splitter = document.getElementById("splitter");
        splitter.style.minHeight = window.innerHeight + "px";
        splitter.style.maxHeight = window.innerHeight + "px";

        this.panels.forEach(panel => panel.fit());
        this.preloader.hide();
    }


    runAction(source, sourceButton) {

        // Get the action
        var action = this.activityManager.getActionForCurrentActivity(source, sourceButton);
        
        let buttonConfig;
        if(action.source.buttons){
            //Buttons defined by activity
            buttonConfig=  action.source.buttons.find( btn => btn.id == sourceButton );
        } else {
            //Buttons defined by tool
            buttonConfig= action.source.ref.buttons.find( btn => btn.id == sourceButton );
        }  
        const toolActionFunction = this.toolsManager.getActionFunction( buttonConfig.actionfunction ); // TODO tidy up by resolving tool references

        // Create map containing panel values
        let parameterMap = new Map();

        for (let paramName of Object.keys(action.parameters)){

            let param = {};
            const panelId = action.parameters[paramName].id;
            
            if (panelId) { 
                const panel = this.activityManager.findPanel(panelId, this.panels);
                param.type = panel.getType();
                param.value = panel.getValue();

            } else {
                // No panel with ID so it use as the parameter value
                const parameterValue = action.parameters[paramName];
                param.type = 'text';
                param.value = parameterValue;
            }

            parameterMap.set(paramName, param);
        }

        // Add the platform language parameter
        let languageParam = {};
        languageParam.type = toolActionFunction.getParameterType("language");
        languageParam.value = action.source.ref.language; // Source panel language
        parameterMap.set("language", languageParam);

            // TODO support output and language 
            //actionRequestData.outputType = outputType;
            //actionRequestData.outputLanguage = outputLanguage;

        // Call backend conversion and service functions
        let actionResultPromise = this.invokeActionFunction(buttonConfig.actionfunction, parameterMap);

        actionResultPromise.catch( () => {
            this.errorNotification("There was an error translating action function parameter types.");
        } );

        this.handleResponseActionFunction(action , actionResultPromise);
    
        this.longNotification("Executing program");
    }


    togglePanelById(elementId) {
        const panelElement = document.getElementById(elementId);
        if (panelElement) {
            const parentElement = panelElement.parentElement;
            this.toggle(parentElement.id);
        }
    }


    notification(title, message, cls="light"){
        const crossIcon = "<div class=\"default-icon-cross\" style=\"float:right\"></div>"
        Metro.notify.create(crossIcon + "<b>"  + title + "</b>" + "<br>" + message + "<br>", null, {keepOpen: true, cls: cls, width: 300});
    }

    longNotification(title, cls="light") {
        this.notification(title + "...", "This may take a few seconds to complete if the back end is not warmed up.", cls);
    }

    successNotification(message, cls="light") {
        this.notification("Success:", message, cls);
    }

    errorNotification(message) {
        console.log("ERROR: " + message);
        this.notification("Error:", message, "bg-red fg-white");
    }


    toggle(elementId, onEmpty) {
        var element = document.getElementById(elementId);
        if (element == null) return;

        if (getComputedStyle(element).display == "none") {
            element.style.display = "flex";
            if (element.innerHTML.length == 0) {
                onEmpty();
            }
        }
        else {
            element.style.display = "none";
        }
        this.updateGutterVisibility();
    }


    updateGutterVisibility() {
        for (const gutter of Array.prototype.slice.call(document.getElementsByClassName("gutter"))) {

            var visibleSiblings = Array.prototype.slice.call(gutter.parentNode.children).filter(
                child => child != gutter && getComputedStyle(child).display != "none");
            
            if (visibleSiblings.length > 1) {
                var nextVisibleSibling = this.getNextVisibleSibling(gutter);
                var previousVisibleSibling = this.getPreviousVisibleSibling(gutter);
                if (nextVisibleSibling != null && nextVisibleSibling.className != "gutter" && previousVisibleSibling != null) {
                    gutter.style.display = "flex";
                }
                else {
                    gutter.style.display = "none";
                }
            }
            else {
                gutter.style.display = "none";
            }
        }
    }

    getNextVisibleSibling(element) {
        var sibling = element.nextElementSibling;
        while (sibling != null) {
            if (getComputedStyle(sibling).display != "none") return sibling;
            sibling = sibling.nextElementSibling;
        }
    }

    getPreviousVisibleSibling(element) {
        var sibling = element.previousElementSibling;
        while (sibling != null) {
            if (getComputedStyle(sibling).display != "none") return sibling;
            sibling = sibling.previousElementSibling;
        }
    }

    savePanelContents(){
        
        let panelsToSave = this.panels.filter (p => p.canSave());

        let fileStorePromises = [];

        // FIXME: This currently creates separate commits for each panel. We really would want one commit for all of them together...
        for(const panel of panelsToSave){
            
            let storePromise = panel.save(this.fileHandler);
            
            if (storePromise!=null) {
                
                storePromise.then( () => {
                    console.log("The contents of panel '" + panel.getId() + "' were saved successfully.");
                });

                fileStorePromises.push(storePromise);
            }
        }
        
        Promise.all(fileStorePromises).then( () => {
            this.successNotification("The activity panel contents have been saved.");
        
        }).catch(() => {
            this.errorNotification("An error occurred while trying to save the panel contents.");
        });
    }

    /**
     * Poll for editor to become available. 
     * @param {String} statusUrl - the url for checking the status of the editor panel.
     * @param {String} editorInstanceUrl - the editor instance's url. 
     * @param {String} editorPanelId - the id of the editor panel.
     * @param {String} editorActivityId - TODO remove as this can be found using editorPanelId to save having to specify in config.
     * @param {Panel} logPanel - the panel to log progress to.
     */
    async checkEditorReady(statusUrl, editorInstanceUrl, editorPanelId, editorActivityId, logPanel){

        let response  = await fetch(statusUrl);

        if (response.status == 200){ 
            const result = await response.json();

            if (result.output){
                logPanel.setValue(result.output);
            }
            
            if (result.error){
                // Unsuccessful
                console.log("Editor failed start.");
                sessionStorage.removeItem(editorPanelId);
                this.activityManager.setActivityVisibility(editorActivityId, false);
                Metro.notify.killAll();
                this.notification("Build Failed", result.error, "ribbed-lightAmber");

            } else if (!result.editorReady){
                await new Promise(resolve => setTimeout(resolve, 2000));
                await this.checkEditorReady(statusUrl, editorInstanceUrl, editorPanelId, editorActivityId, logPanel);

            } else {
                // Successful 
                console.log("Editor ready.");
                sessionStorage.setItem( editorPanelId , editorInstanceUrl );
                this.activityManager.setActivityVisibility(editorActivityId, true);
                Metro.notify.killAll();
                this.successNotification("Building complete.");
            }

        } else {
            console.log("ERROR: The editor response could not be checked: " + statusUrl);
            this.errorNotification("Failed to start the editor.");
        }
    }
}

export {EducationPlatformApp}