// ==UserScript==
// @name        Jira Ticket Copier
// @description Use a right-click context menu to copy the Ticket-Key ("Id") and Ticket-Summary ("Title") either as a link or as text only for any ticket that appears on a JIRA page.
// @version     0.7
// @author      code@bastianbaumeister.de
//
// @updateURL   https://raw.githubusercontent.com/cherub-i/jira-ticket-copier/main/jira-ticket-copier.user.js
// @namespace   https://github.com/cherub-i/jira-ticket-copier
// @icon        https://www.google.com/s2/favicons?domain=jira.atlassian.com
//
// @match       https://*/jira/*
// @match       https://jira./*
//
// @grant       none
// @require     https://raw.githubusercontent.com/cherub-i/jira-ticket-copier/main/context-menu.js
// ==/UserScript==

(function() {
    'use strict';

    //---- configuration start -----------------------------------------
    //
    let rescanIntervalSecs = 3;     // interval for checking the page for new ticket links
    let jiraLinkTypesToCheck = [    // types of links to add the menu to, comment out types you do not want
        'issue-detail/header',
        'issue-detail/subticket-header',
        'issue-detail/description',
        'issue-detail/comment',
        'issue-detail/linked-issues',
        'issue-detail/sub-tasks',
        'issue-list/list-view',
        'issue-list/detail-view',
        'issue-board/card-view',
        'issue-board/list-view',
        'issue-board/detail',
    ];
    let printConsoleInfo = true;

    // textual representation
    let ticketAsText = function(key, summary) { return key + ' ' + summary; };

    // link representation
    let ticketAsLink = function(key, summary, url) { return '<a href="' + url + '">' + key + ' ' + summary + '</a>'; };
    //
    //---- configuration end -------------------------------------------

    class TicketData {
        constructor(issueKey, issueUrl, issueSummary) {
            this.issueKey = issueKey;
            this.issueUrl = issueUrl;
            this.issueSummary = issueSummary;
        }

        get link() {
            return ticketAsLink(this.issueKey, this.issueSummary, this.issueUrl);
        }

        get text() {
            return ticketAsText(this.issueKey, this.issueSummary);
        }
    }

    class TicketGatherer {
        static elementTypes = {
            'issue-detail/header': { // e.g. https://JIRA_SERVER/browse/TICKET-485
                'selector':             'a#key-val',
                'id':                   element => element.innerText,
                'issueURL':             element => element.href,
                'issueKey':             element => element.innerText,
                'issueSummary':         element => element.parentNode.parentNode.parentNode.parentNode/*.childNodes[1]*/.querySelector("#summary-val").innerText,
                'menuParentElement':    element => element.parentNode,
                'menuBeforeElement':    element => element.nextSibling,
            },
            'issue-detail/subticket-header': { // e.g. https://JIRA_SERVER/browse/TICKET-484
                'selector':             'a#parent_issue_summary',
                'id':                   element => element.attributes['data-issue-key'].value,
                'issueURL':             element => element.href,
                'issueKey':             element => element.attributes['data-issue-key'].value,
                'issueSummary':         element => element.parentNode.parentNode.parentNode.childNodes[1].innerText,
                'menuParentElement':    element => element.parentNode,
                'menuBeforeElement':    element => element.nextSibling,
            },
            'issue-detail/description': { // e.g. https://JIRA_SERVER/browse/TICKET-485
                'selector':             'div.user-content-block a.issue-link',
                'id':                   element => element.innerText,
                'issueURL':             element => element.href,
                'issueKey':             element => element.innerText,
                'issueSummary':         element => element.title,
                'menuParentElement':    element => element.parentNode,
                'menuBeforeElement':    element => element.nextSibling,
            },
            'issue-detail/comment': { // e.g. https://JIRA_SERVER/browse/TICKET-485
                'selector':             'div.action-body a.issue-link',
                'id':                   element => element.innerText,
                'issueURL':             element => element.href,
                'issueKey':             element => element.innerText,
                'issueSummary':         element => element.title,
                'menuParentElement':    element => element.parentNode,
                'menuBeforeElement':    element => element.nextSibling,
            },
            'issue-detail/linked-issues': { // e.g. https://JIRA_SERVER/browse/TICKET-485
                'selector':             'div.link-content a.issue-link',
                'id':                   element => element.innerText,
                'issueURL':             element => element.href,
                'issueKey':             element => element.innerText,
                'issueSummary':         element => element.parentNode.querySelector('span.link-summary').innerText,
                'menuParentElement':    element => element.parentNode,
                'menuBeforeElement':    element => element.nextSibling,
            },
            'issue-detail/sub-tasks': { // e.g. https://JIRA_SERVER/browse/TICKET-485
                'selector':             'div.subtask-table-container td.stsummary a.issue-link',
                'id':                   element => element.innerText,
                'issueURL':             element => element.href,
                'issueKey':             element => element.attributes['data-issue-key'].value,
                'issueSummary':         element => element.innerText,
                'menuParentElement':    element => element.parentNode,
                'menuBeforeElement':    element => element.nextSibling,
            },
            'issue-list/list-view': { // e.g. https://JIRA_SERVER/issues/?filter=-2
                'selector':             'td.issuekey>a.issue-link:not(.hidden-link)',
                'id':                   element => element.innerText,
                'issueURL':             element => element.href,
                'issueKey':             element => element.innerText,
                'issueSummary':         element => element.parentNode.parentNode.querySelector('td.summary').innerText,
                'menuParentElement':    element => element.parentNode,
                'menuBeforeElement':    element => element.nextSibling,
            },
            'issue-list/detail-view': { // e.g. https://JIRA_SERVER/browse/TICKET-485?filter=-1
                'selector':             'span.issue-link-key',
                'id':                   element => element.innerText,
                'issueURL':             element => element.parentNode.parentNode.parentNode.href,
                'issueKey':             element => element.innerText,
                'issueSummary':         element => element.parentNode.parentNode.querySelector('span.issue-link-summary').innerText,
                // TODO improve layout of menu placement
                'menuParentElement':    element => element.parentNode,
                'menuBeforeElement':    element => element.nextSibling,
            },
            'issue-board/card-view': { // e.g. https://JIRA_SERVER/secure/RapidBoard.jspa?rapidView=6294&view=detail&selectedIssue=TICKET-484&quickFilter=30822
                'selector':             'div.ghx-issue-fields a.js-key-link',
                'id':                   element => element.innerText,
                'issueURL':             element => element.href,
                'issueKey':             element => element.innerText,
                'issueSummary':         element => element.parentNode.parentNode.childNodes[1].innerText,
                // TODO improve layout of menu placement
                'menuParentElement':    element => element.parentNode,
                'menuBeforeElement':    element => element.nextSibling,
            },
            'issue-board/list-view': { // e.g. https://JIRA_SERVER/secure/RapidBoard.jspa?rapidView=6294&view=detail&selectedIssue=TICKET-484&quickFilter=30822
                'selector':             'div.ghx-row a.js-key-link',
                'id':                   element => element.innerText,
                'issueURL':             element => element.href,
                'issueKey':             element => element.innerText,
                'issueSummary':         element => element.parentNode.parentNode.querySelector('div.ghx-summary').innerText,
                'menuParentElement':    element => element.parentNode,
                'menuBeforeElement':    element => element.nextSibling,
            },
            'issue-board/detail': { // e.g. https://JIRA_SERVER/secure/RapidBoard.jspa?rapidView=6294&view=detail&selectedIssue=TICKET-484&quickFilter=30822
                'selector':             '#issuekey-val',
                'id':                   element => element.childNodes[0].innerText,
                'issueURL':             element => element.childNodes[0].href,
                'issueKey':             element => element.childNodes[0].innerText,
                'issueSummary':         element => element.parentNode.parentNode.parentNode.parentNode.parentNode.childNodes[1].innerText,
                'menuParentElement':    element => element.parentNode,
                'menuBeforeElement':    element => element.nextSibling,
            },
        };
        // TODO: 'issue-board/epic-pane' // e.g. https://JIRA_SERVER/secure/RapidBoard.jspa?rapidView=6294&view=detail&selectedIssue=TICKET-484&quickFilter=30822


        constructor(rootElement, ticketData) {
            this.rootElement = rootElement;
            this.ticketData = ticketData;
        }

        processAllTypes() {
            for(let type in TicketGatherer.elementTypes) {
                this.processType(type);
            }
        }

        processType(type) {
            // TODO maybe proof against type not existing
            let typeToLookFor = TicketGatherer.elementTypes[type];
            let elementList = this.rootElement.querySelectorAll(typeToLookFor.selector);

            for (let i = 0; i < elementList.length; i++) {
                let id = typeToLookFor.id(elementList[i])
                if (!(id in this.ticketData)) {
                    this.ticketData[id] = new TicketData(
                        typeToLookFor.issueKey(elementList[i]),
                        typeToLookFor.issueURL(elementList[i]),
                        typeToLookFor.issueSummary(elementList[i]),
                    );
                }

                let menuParentElement = typeToLookFor.menuParentElement(elementList[i])
                // TODO: bei zwei Ticket-IDs in einem LI in einem Comment bekommt das zweite wegen der folgenden Prüfung kein Menu-Element. Im querySeletor oder danach noch auf data-issue-key = Ticket ID prüfen? Nicht querySelectorAll sondern nur einen Suchen und darauf rpüfen.
                if (menuParentElement.querySelectorAll('.' + ActionsMenu.class).length == 0) {
                    let actionsMenu = new ActionsMenu(id);
                    actionsMenu.attach(menuParentElement, typeToLookFor.menuBeforeElement(elementList[i]));
                }
            }
        }
    }

    class ActionsMenu {
        static class = 'actions-menu';
        static idAttribute = 'data-am-key';

        constructor(id) {
            this.actionsMenu = document.createElement('button');

            this.actionsMenu.style.border = 'none';
            this.actionsMenu.style.marginLeft = '.3rem';
            this.actionsMenu.style.height = '13px';
            this.actionsMenu.style.width = '13px';
            this.actionsMenu.style.borderRadius = '50%';
            this.actionsMenu.style.backgroundColor = 'magenta'; // oder gelb? #FFE500
            this.actionsMenu.setAttribute(ActionsMenu.idAttribute, id);

            this.actionsMenu.className = ActionsMenu.class
        }

        get element() {
            return this.actionsMenu
        }

        attach(parentElement, beforeElement) {
            parentElement.insertBefore(this.element, beforeElement);
        }

        static initMenus(items) {
            this.menu = new ContextMenu('.' + ActionsMenu.class, items);
        }
    }

    function copyToClip(str) {
        // https://stackoverflow.com/questions/23934656/javascript-copy-rich-text-contents-to-clipboard

        function listener(e) {
            e.clipboardData.setData('text/html', str);
            e.clipboardData.setData('text/plain', str);
            e.preventDefault();
        }
        document.addEventListener('copy', listener);
        document.execCommand('copy');
        document.removeEventListener('copy', listener);

        if (printConsoleInfo) {
            console.log(consoleLogPrefix + 'INFO | copied to clipboard: ' + str);
        }
    }

    function worker() {
        try {
            // ticketGatherer.processAllTypes();
            for (let type of jiraLinkTypesToCheck) {
                ticketGatherer.processType(type);
            }

            if (Object.keys(ticketData).length > 0 && !menuInitialized) {
                ActionsMenu.initMenus([
                    { name: 'Als Link kopieren', fn: function(target) { copyToClip(ticketData[target.getAttribute(ActionsMenu.idAttribute)].link); }},
                    { name: 'Als Text kopieren', fn: function(target) { copyToClip(ticketData[target.getAttribute(ActionsMenu.idAttribute)].text); }},
                ]);
                menuInitialized = true;
            }

        } catch (e) {
            // eslint-disable-next-line no-console
            console.log(consoleLogPrefix + 'ERROR | unknown exception: ' + e);
        }
    }

    let consoleLogPrefix = 'JIRA Ticket Copier | ';
    let ticketData = {};
    let ticketGatherer = new TicketGatherer(document, ticketData);

    let menuInitialized = false;
    // continuously scan for new links
    setInterval(worker, rescanIntervalSecs*1000);
})();