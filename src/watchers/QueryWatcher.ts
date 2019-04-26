import Adoscope from "../Adoscope";

/*
 * File:          QueryWatcher.ts
 * Project:       adoscopejs
 * Created Date:  22/04/2019 1:07:02
 * Author:        Paradox
 *
 * Last Modified: 26/04/2019 9:49:00
 * Modified By:   Paradox
 *
 * Copyright (c) 2019 Paradox.
 */

import * as pluralize from 'pluralize'
import * as _ from 'lodash'
import * as prettyMs from 'pretty-ms'
import onChange from 'on-change'

import { Database, AdoscopeQuery } from '../Contracts'
import EntryType from '../EntryType'
import Watcher from '../watchers/Watcher'

const now = require('performance-now')

/**
 * Class used to listen to all queries and store them into database.
 *
 * @export
 *
 * @class QueryWatcher
 *
 * @extends {Watcher}
 */
export default class QueryWatcher extends Watcher {
  private _statements: {[x: string]: object}

  constructor (
    private _database: Database,
    private _queries: Map<string, AdoscopeQuery> = new Map()
  ) {
    super()

    this._listen()
    this._onChange()
  }

  /**
   * Listens to all queries throughout application and stores them
   * into [this._queries].
   *
   * @private
   *
   * @method _listen
   *
   * @memberof QueryWatcher
   */
  private _listen (): void {
    this._database.on('query', (query: AdoscopeQuery) => {
      this._queries.set(
        query.__knexQueryUid, {
          start: now(),
          finished: false,
          method: query.method,
          bindings: query.bindings
        }
      )
    })
  }

  /**
   * When query is added to [this._statements], store it into database.
   *
   * @private
   *
   * @method _onChange
   *
   * @memberof QueryWatcher
   */
  private _onChange (): void {
    this._statements = onChange({}, async (path: string, value: AdoscopeQuery) => {
      await this._store(EntryType.QUERY, value)
    })
  }

  /**
   * Checks if the query's table is not an Adoscope table.
   *
   * @private
   *
   * @method _approveQuery
   *
   * @param {string} table
   *
   * @returns {boolean}
   *
   * @memberof QueryWatcher
   */
  private _approveQuery (table: string): boolean {
    if (table === 'adoscope_entries') {
      return false
    }

    return true
  }

  /**
   * Stores query's details into [this._statements] when executed.
   *
   * @method record
   *
   * @memberof QueryWatcher
   */
  public record (): void {
    this._database.on('query-response', async (response: any, query: Database.Sql, builder: Database.Builder) => {
      const table = builder._single.table

      if (!this._approveQuery(table)) {
        return
      }

      const end = now()

      let _query: AdoscopeQuery = this._queries.get(query.__knexQueryUid)
      _query = {
        ..._query,
        end,
        time: Math.round(parseFloat((end - _query.start).toFixed(2))),
        finished: true,
        query: builder.toString(),
        table
      }

      _query.stringTime = prettyMs(_query.time)

      this._statements[query.__knexQueryUid] = _query

      /*if (Adoscope.recordingRequest) {
        Adoscope.data[pluralize.plural(entryType)].push(_query)
      }*/
    })
  }
}
