# JIRA Ticket Copier

## Installation

1. [Install Tampermonkey](https://www.tampermonkey.net/)
2. open the JIRA Ticket Copier script file [`jira-ticket-copier.user.js`](https://github.com/ciis0/jira-ticket-copier/raw/refs/heads/main/jira-ticket-copier.user.js)

### Updates
If you want to, you can enable Tampermonkey to look for updates for this script:

1. on the Tampermonkey Overview page
2. from the "Installed Userscripts" tab, open the "JIRA Ticket Copier"
3. under "Settings", enable "Search for Updates"
4. click "Save"

In order to manually pull an update:

1. on the Tampermonkey Overview page
2. from the "Installed Userscripts" tab, open the "JIRA Ticket Copier"
3. under "Editor", use the menu item "Files" / "Look for updates"

If that option is greyed out, you need to enable "Search for Updates" first (and maybe do a reload of the page).

## What it does
When you view a webpage from a JIRA server, every mentioning of a JIRA ticket on that page is adorned with magenta dot. Right-clicking on that element allows you to copy the information for that ticket to your clipboard - either as text or as a link.

Once you have the script installed in Tampermonkey, you can go to the editor-view for that script. At the top of the code you will find a block named "configuration". That's where you can do a bit of customization to your needs.

## Version History

### 0.5
* fixed bug: no summary found for issue board view as list
* split up detection for "issue-board/card" into "issue-board/card-view" and "issue-board/list-view"

### 0.4
* fixed bug: menu was generated indefinitely often - when just one is enough
* fixed bug: on Firefox, menu text was picked up by JIRA comment fields

### 0.3 
* fixed bug: individual configuration was not possible

### 0.2 
* major refactoring, added configuration possibilities

### 0.1
* initial, first version