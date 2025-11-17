import { ProtoBrowser } from '../ProtoBrowser'

const DEBUG = process.env.TEST_DEBUG === 'true';

const { execSync } = require('child_process');
const path = require('path')
const { v4: uuidv4 } = require('uuid');
// Page menu opts
const PAGE_TEMPLATES = {
    BLANK: "blank",
    DEFAULT: "default",
    ADMIN: "admin",
    LANDING: "landing",
    ECOMERCE: "ecomerce",
    NEWSFEED: "newsfeed",
}
// Api menu opt
const API_TEMPLATES = {
    Automatic_CRUD: "automatic-crud",
    Automatic_CRUD_Custom_Storage: "automatic-crud-storage",
    IOT_Router: "iot-router",
    Custom: "custom-api"
}
// Api menu opt
const API_OBJECT_OPTIONS = {
    Without_Object: 0
}
const USER_IDENTIFIER = 'user@user.user'
const USER_PASSWORD = 'user1234'

describe("Basic tests", () => {
    let protoBrowser: ProtoBrowser;
    beforeAll(async () => {
        protoBrowser = await ProtoBrowser.__newInstance__(!DEBUG)
    }, 600000)
    afterAll(async () => {
        await protoBrowser?.close()
    })

    it("should have a public sign in authentication interface", async () => {
        await protoBrowser.navigateToLogin()
        expect(await protoBrowser.getUrlPath()).toBe('/auth/login');
        expect(await protoBrowser.waitForElement('#sign-in-username-input')).toBeTruthy();
        expect(await protoBrowser.waitForElement('#sign-in-password-input')).toBeTruthy();
        expect(await protoBrowser.waitForElement('#sign-in-btn')).toBeTruthy();
    }, 120000)

    it("should have a public sign up authentication interface", async () => {
        await protoBrowser.navigateToRegister();
        expect(await protoBrowser.getUrlPath()).toBe('/auth/register');
        expect(await protoBrowser.waitForElement('#sign-up-email-input')).toBeTruthy();
        expect(await protoBrowser.waitForElement('#sign-up-password-input')).toBeTruthy();
        expect(await protoBrowser.waitForElement('#sign-up-repassword-input')).toBeTruthy();
        expect(await protoBrowser.waitForElement('#sign-up-btn')).toBeTruthy();
        expect(await protoBrowser.waitForElement('#sign-in-link')).toBeTruthy();
    }, 30000)
    // Disabled due that by default register is disabled
    // it.skip("should be able to register and retrieve a session using sign up interface", async () => { // sikpped: Signup is disabled by default
    //     await protoBrowser.navigateToRegister()
    //     await protoBrowser.waitForElement('#sign-up-email-input');
    //     await protoBrowser.signUpFlow(`randomuser-${uuidv4()}@noreply.com`, 'changeme4321');
    //     expect(await protoBrowser.getUrlPath()).toBe('/')
    // }, 60000)
    // it.skip("should have a documentation page", async () => { // sikpped: docs are disabled by default
    //     await protoBrowser.navigateToDocumentation()
    //     expect(await protoBrowser.waitForElement('#__next')).toBeTruthy();
    // }, 30000)
})
describe("Test admin capabilities", () => {
    let protoBrowser: ProtoBrowser;

    beforeAll(async () => { // Create a user with admin role
        try {
            const output = execSync(`cd ${path.join(__dirname, '..', '..', '..')} && yarn add-user ${USER_IDENTIFIER} ${USER_PASSWORD} admin`, { encoding: 'utf-8', stdio: 'inherit' })
            expect(output.includes('Done')).toBeTruthy();
        } catch (e) { } // Prevent crash when user already exist
        // Login and navigate to workspace
        protoBrowser = await ProtoBrowser.__newInstance__(!DEBUG)
        await protoBrowser.navigateToLogin();
        await protoBrowser.signInSubmit(USER_IDENTIFIER, USER_PASSWORD);
        await protoBrowser.waitForElement('#header-session-user-id');
    }, 60000)

    afterAll(async () => {
        await protoBrowser?.close()
    })

    describe("Test entities autocreation", () => {
        describe("test api creations", () => {
            it("should be able to create an empty api", async () => {
                const apiName = 'testapi'
                await protoBrowser.navigateToAdminSection('apis')
                await protoBrowser.getEditableObjectCreate()
                // Select template
                await protoBrowser.clickElement(`#template-card-${API_TEMPLATES.Custom}`)
                await protoBrowser.clickElement(`#admin-apis-add-btn`)
                // Configure api
                await protoBrowser.fillEditableObjectInput('name', apiName)
                await protoBrowser.clickElement(`#admin-apis-add-btn`)
                expect(await protoBrowser.getElementText(`#apis-datatable-${apiName}`)).toBe(apiName);
            }, 60000)
        })

        describe("test object creation", () => {
            beforeEach(async () => {
                await protoBrowser.navigateToAdminSection('objects')
                await protoBrowser.getEditableObjectCreate()
            }, 60000)

            it("should be able to create a simple object", async () => {
                expect(await protoBrowser.getElementText('#eo-dlg-title')).toBe('Add Object')
                const objectName = 'testObject'
                await protoBrowser.fillEditableObjectInput('name', objectName)
                // Open editable form
                await protoBrowser.clickElement("xpath=//*[@id='eo-formgroup']/div/div/span/span/button")
                await protoBrowser.clickElement("#eo-obj-comp-btn")
                // Fill object key
                const keyName = "myKey"
                await protoBrowser.waitForElement("xpath=//*[@id='eo-add-field-input']/span/span/input");
                await protoBrowser.getPage().fill("xpath=//*[@id='eo-add-field-input']/span/span/input", keyName);
                await protoBrowser.clickElement("#alert-dlg-accept")
                await protoBrowser.submitEditableObject()
                await protoBrowser.waitForElement(`#objects-datatable-${objectName}`)
                expect(await protoBrowser.getElementText(`#objects-datatable-${objectName}`)).toBe(objectName);
            }, 60000)
        })

        describe("test page entity", () => {
            const pageName = 'testpage'
            const pageRoute = 'testpage'
            describe("test page creation", () => {
                beforeEach(async () => {
                    await protoBrowser.navigateToAdminSection('pages')
                    await protoBrowser.getEditableObjectCreate()
                }, 60000)
                it("should be able to create a blank page", async () => {
                    // Select template
                    await protoBrowser.clickElement(`#pages-template-${PAGE_TEMPLATES.BLANK}`)
                    await protoBrowser.clickElement(`#admin-pages-add-btn`)
                    // Configure page
                    await protoBrowser.fillEditableObjectInput('name', pageName)
                    await protoBrowser.fillEditableObjectInput('route', pageRoute)
                    await protoBrowser.clickElement(`#admin-pages-add-btn`)
                    expect(await protoBrowser.getElementText(`#pages-datatable-${pageName}`)).toBe(pageName);
                }, 60000)
            })

            describe("test edit page", () => {
                beforeEach(async () => {
                    await protoBrowser.navigateToAdminSection('pages')
                }, 60000)
                it("should be able to edit the page", async () => {
                    await protoBrowser.waitForElement('#admin-dataview-add-btn');
                    await protoBrowser.clickElement("#more-btn-home")
                    await protoBrowser.clickElement("#more-btn-home-option-1")
                    expect(await protoBrowser.waitForElement('#file-widget-home')).toBeTruthy();
                }, 60000)
            })

            describe("test delete page", () => {
                beforeEach(async () => {
                    await protoBrowser.navigateToAdminSection('pages')
                }, 60000)
                it("should be able to delete the page", async () => {
                    await protoBrowser.waitForElement('#admin-dataview-add-btn');
                    await protoBrowser.clickElement(`#more-btn-${pageName}`)
                    await protoBrowser.clickElement(`#more-btn-${pageName}-delete`)
                    await protoBrowser.clickElement(`#alert-dlg-accept`)
                    await protoBrowser.navigateToAdminSection('pages')
                    expect(await protoBrowser.waitDeletedElement(`#pages-datatable-${pageName}`, 4000)).toBe(true)
                }, 60000)
            })
            describe("test multiple page delete using top row delete button", () => {
                beforeEach(async () => {
                    await protoBrowser.navigateToAdminSection('pages')
                    await protoBrowser.getEditableObjectCreate()
                }, 60000)
                it("should be able to create a blank page", async () => {
                    // Select template
                    await protoBrowser.clickElement(`#pages-template-${PAGE_TEMPLATES.BLANK}`)
                    await protoBrowser.clickElement(`#admin-pages-add-btn`)
                    // Configure page
                    await protoBrowser.fillEditableObjectInput('name', "testpagemultipledelete1")
                    await protoBrowser.fillEditableObjectInput('route', "testpagemultipledelete1")
                    await protoBrowser.clickElement(`#admin-pages-add-btn`)
                    expect(await protoBrowser.getElementText(`#pages-datatable-testpagemultipledelete1`)).toBe("testpagemultipledelete1");
                }, 60000)
                it("should be able to create a blank page", async () => { // TESTING
                    // Select template
                    await protoBrowser.clickElement(`#pages-template-${PAGE_TEMPLATES.BLANK}`)
                    await protoBrowser.clickElement(`#admin-pages-add-btn`)
                    // Configure page
                    await protoBrowser.fillEditableObjectInput('name', "testpagemultipledelete2")
                    await protoBrowser.fillEditableObjectInput('route', "testpagemultipledelete2")
                    await protoBrowser.clickElement(`#admin-pages-add-btn`)
                    expect(await protoBrowser.getElementText(`#pages-datatable-testpagemultipledelete2`)).toBe("testpagemultipledelete2");
                }, 60000)
                it("should be able to delete 2 pages from top menu", async () => {
                    await protoBrowser.navigateToAdminSection('pages')
                    await protoBrowser.waitForElement('#admin-dataview-add-btn');
                    await protoBrowser.clickElement(`#select-checkbox-testpagemultipledelete1`)
                    await protoBrowser.clickElement(`#select-checkbox-testpagemultipledelete2`)
                    await protoBrowser.clickElement(`#more-btn-pages`)
                    await protoBrowser.clickElement(`#more-btn-pages-delete`)
                    await protoBrowser.clickElement(`#alert-dlg-accept`)
                    await protoBrowser.navigateToAdminSection('pages')
                    expect(await protoBrowser.waitDeletedElement(`#pages-datatable-testpagemultipledelete1`, 4000) && await protoBrowser.waitDeletedElement(`#pages-datatable-testpagemultipledelete2`, 4000)).toBe(true)
                }, 60000)
            })
        })
    })
    // describe("Testing page in useEdit mode", () => {
    //     it("should be able to navigate to visualui", async () => {
    //         await protoBrowser.goTo('');
    //         await protoBrowser.clickElement("#use-edit-btn")
    //         const locator = await protoBrowser.waitForElement("#editor-frame-container", 200000)
    //         expect(locator).toBeTruthy()
    //     }, 200000)

    //     it("should be able to save edited page content", async () => {
    //         const vp = ProtoBrowser.getViewPortSize()
    //         await protoBrowser.mouseClick(Math.floor(vp.width / 2), Math.floor(vp.height / 2))
    //         await protoBrowser.clickElement("#render-node-options-btn", 100000)
    //         await protoBrowser.clickElement("#render-node-delete-btn", 100000)
    //         await protoBrowser.clickElement("#save-nodes-btn", 100000)
    //         let error
    //         try {
    //             // If "#nextjs__container_build_error_label" exist, means that has error compiling
    //             await protoBrowser.waitForElement("#nextjs__container_build_error_label", 100000)
    //         } catch (e) {
    //             error = !!e
    //         }
    //         expect(error).toBeTruthy()
    //     }, 200000)

    //     it("should be able to drag and drop all components", async () => {
    //         const allDraggablesIds = await protoBrowser.getClassNameIds('.draggable-element')
    //         // TODO: Test all draggable elements instead of the first one (now avoid 7 extra minutes just for this test).
    //         const draggablesIds = [allDraggablesIds[0]]
    //         for (const elementId of draggablesIds) {
    //             await protoBrowser.clickElement("#components-to-drag-btn", 10000)
    //             await protoBrowser.evaluate(".glass", element => element.style.display = 'none')
    //             await protoBrowser.waitForElement(".glass", 100000, { state: "hidden" })
    //             await protoBrowser.waitForElement(".visualui-sidebar", 10000)
    //             await protoBrowser.dragAndDrop('#' + elementId, "#home-page")
    //             //TODO: change "#left-actions-container" id for components container id 
    //             // await protoBrowser.evaluate("#left-actions-container", element => element.style.display = 'flex')
    //         }
    //     }, 200000)
    // }) 
})
