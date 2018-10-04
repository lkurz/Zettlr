/* global $ */
/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        ZettlrToolbar class
 * CVM-Role:        View
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     Handles the toolbar
 *
 * END HEADER
 */

const { trans } = require('../common/lang/i18n.js')
const { localiseNumber } = require('../common/zettlr-helpers.js')
const tippy = require('tippy.js')

/**
 * This class is responsible for rendering the Toolbar. It builds the toolbar
 * based on the toolbar.json file in the assets directory. Therefore one can
 * think of hooks to implement buttons dynamically in the future (e.g., for
 * plugins).
 */
class ZettlrToolbar {
  /**
     * Initialize the toolbar handlers and activate
     * @param {ZettlrRenderer} parent The renderer object
     */
  constructor (parent) {
    this._renderer = parent
    this._div = $('#toolbar')
    this._build()
    this._searchbar = this._div.find('.searchbar').first().find('input').first()
    this._searchbar.attr('placeholder', trans('gui.find_placeholder'))
    this._fileInfo = this._div.find('.file-info')

    // Create the progress indicator circle and insert it hidden
    this._searchProgress = $('<svg id="search-progress-indicator" class="hidden" width="20" height="20" viewBox="-1 -1 2 2"><circle class="indicator-meter" cx="0" cy="0" r="1" shape-rendering="geometricPrecision"></circle><path d="" fill="" class="indicator-value" shape-rendering="geometricPrecision"></path></svg>')
    this._searchProgress.insertAfter($('#toolbar .searchbar').first())
    // Searchbar autocomplete variables
    this._autocomplete = []
    this._oldval = ''

    this._act()
  }

  /**
     * Activate event listeners
     * @return {void} Nothing to return.
     */
  _act () {
    // Activate search function.
    this._searchbar.on('keyup', (e) => {
      if (e.which === 27) { // ESC
        this._searchbar.blur()
        this._searchbar.val('')
        this._renderer.exitSearch()
      } else if (e.which === 13) { // RETURN
        this._renderer.beginSearch(this._searchbar.val())
        this._searchbar.select() // Select everything in the area.
      } else {
        if (e.which === 8 || e.which === 46) return // DEL or backspace has been pressed
        if ((this._searchbar.val() === '') || (this._searchbar.val() === this._oldval)) return // Content has not changed
        // Any other key has been pressed
        this._oldval = this._searchbar.val()
        for (let name of this._autocomplete) {
          if (name.substr(0, this._oldval.length).toLowerCase() === this._oldval.toLowerCase()) {
            this._searchbar.val(this._oldval + name.substr(this._oldval.length)).select().focus()
            let e = this._searchbar[0] // Retrieve actual DOM element
            if (e.setSelectionRange) { e.setSelectionRange(this._oldval.length, this._searchbar.val().length) }
            break
          }
        }
        this._oldval = this._searchbar.val() // Now this is the old value
      }
    })

    this._div.find('.end-search').on('click', (e) => {
      this._searchbar.blur()
      this._searchbar.val('')
      this._renderer.exitSearch()
    })

    this._searchbar.on('focus', (e) => {
      this._searchbar.select()
      this._autocomplete = this._renderer.getFilesInDirectory()
    })

    this._searchbar.on('blur', (e) => {
      this._autocomplete = [] // Reset auto completion array
      this._oldval = ''
    })

    this._fileInfo.click((e) => {
      this._renderer.getBody().showFileInfo()
    })

    // Activate buttons
    // -- so beautifully DRY <3
    this._div.find('.button').on('click', (e) => {
      let elem = $(e.currentTarget)
      let command = elem.attr('data-command') || 'unknown-command'
      let content = elem.attr('data-content') || {}

      this._renderer.handleEvent(command, content)
    })

    // Enable maximise window only on double-click of the toolbar
    this._div.on('dblclick', (e) => {
      this._renderer.handleEvent('app-maximise')
      // console.log(`Doubleclick requested!`)
    })

    // Tippify all buttons
    tippy('#toolbar .button', {
      delay: 100,
      arrow: true,
      duration: 100,
      flip: true
    })
  }

  /**
    * This builds the toolbar
    * @return {void} No return.
    */
  _build () {
    let tpl = require('./assets/toolbar/toolbar.json').toolbar

    // Append everything to the div.
    for (let elem of tpl) {
      let child = $('<div>').addClass(elem.role)
      if (elem.role === 'button') {
        child.addClass(elem.class)
        child.attr('data-command', elem.command)
        child.attr('data-content', elem.content)
        child.attr('title', trans(elem.title))
      } else if (elem.role === 'searchbar') {
        child.html('<input type="text"><div class="end-search">&times;</div>')
      } else if (elem.role === 'pomodoro') {
        child.addClass('button')
        child.attr('data-command', 'pomodoro')
        child.html('<svg width="20" height="20" viewBox="-1 -1 2 2"><circle class="pomodoro-meter" cx="0" cy="0" r="1" shape-rendering="geometricPrecision"></circle><path d="" fill="" class="pomodoro-value" shape-rendering="geometricPrecision"></path></svg>')
      }
      this._div.append(child)
    }
  }

  /**
    * Updates the word count in the info area
    * @param  {Integer} words Wordcount
    * @return {void}       Nothing to return
    */
  updateWordCount (words) {
    if (words === 0) {
      return this.hideWordCount()
    }

    this._fileInfo.text(trans('gui.words', localiseNumber(words)))
  }

  /**
    * Hides the word count
    * @return {ZettlrToolbar} Chainability.
    */
  hideWordCount () {
    this._fileInfo.text('')
    return this
  }

  /**
    * Toggles the distraction free's mute class on the toolbar.
    * @return {ZettlrToolbar} This for chainability.
    */
  toggleDistractionFree () {
    this._div.toggleClass('mute')
    return this
  }

  /**
    * Focuses the search area
    * @return {ZettlrToolbar} Chainability.
    */
  focusSearch () {
    this._searchbar.focus()
    this._searchbar.select()
    return this
  }

  /**
    * Overrides the current contents of the searchbar.
    * @param {String} term The new value to be written into the searchbar.
    */
  setSearch (term) {
    this._searchbar.val(term)
  }

  /**
    * Progresses the search indicator
    * @param  {Integer} item    Current items that have been searched
    * @param  {Integer} itemCnt Overall amount of items to be searched
    * @return {void}         Nothing to return.
    */
  searchProgress (item, itemCnt) {
    if (this._searchProgress.hasClass('hidden')) {
      this._searchProgress.removeClass('hidden')
    } else {
      let progress = item / itemCnt
      let large = (progress > 0.5) ? 1 : 0
      let x = Math.cos(2 * Math.PI * progress)
      let y = Math.sin(2 * Math.PI * progress)
      this._searchProgress.find('.indicator-value').attr('d', `M 1 0 A 1 1 0 ${large} 1 ${x} ${y} L 0 0`)
    }
  }

  /**
    * Ends the search by resetting the indicator
    * @return {void} Nothing to return.
    */
  endSearch () {
    this._searchProgress.addClass('hidden')
  }
}

module.exports = ZettlrToolbar
