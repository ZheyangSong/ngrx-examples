import {Injectable} from "@angular/core";
import {Store, Action} from "@ngrx/store";
import {Observable} from "rxjs/Observable";
import {Subject} from "rxjs/Subject";
import {Reddit} from "../services/reddit";
import {
    REQUEST_POSTS,
    RECEIVE_POSTS,
    INVALIDATE_REDDIT,
    SELECT_REDDIT
} from "../reducers/reddit";


@Injectable()
export class RedditActions{
    private actions$: Subject<Action> = new Subject<Action>();

    constructor(
        private _store : Store<any>,
        private _reddit : Reddit
    ){
        const posts$ = _store.select(state => state.postsByReddit);
        /*
            In future examples we will see how to handle side-effects with ngrx/effect.
        */
        const selectReddit = this.actions$
            .filter((action : Action) => action.type === SELECT_REDDIT);
    
        const invalidateReddit = this.actions$
            .filter((action : Action) => action.type === INVALIDATE_REDDIT);

        const fetchPostsIfNeeded = selectReddit
            /*
                Grab last emitted value from given observable.
                For more on withLatestFrom: https://gist.github.com/btroncone/d6cf141d6f2c00dc6b35#withLatestFrom
            */
            .withLatestFrom(posts$)
            .filter(([action, posts]) => this.shouldFetchPosts(posts, action.payload))

        const fetchPosts = fetchPostsIfNeeded
            .do(([action]) => { _store.dispatch({type : REQUEST_POSTS, payload: {reddit: action.payload}})})
            /*
                If data does not exist, fetch posts.
                For more on flatMap: https://gist.github.com/btroncone/d6cf141d6f2c00dc6b35#flatMap
            */
            .flatMap(([action]) => _reddit
                                    .fetchPosts(action.payload)
                                    .map(({data}) => ({ type: RECEIVE_POSTS, payload: {reddit: action.payload, data}})));

        Observable
            /*
                For more on merge: https://gist.github.com/btroncone/d6cf141d6f2c00dc6b35#merge
            */
            .merge(selectReddit, invalidateReddit, fetchPosts)
            .subscribe(_store);
    }

    selectReddit(reddit: string){
        this.actions$.next({type: SELECT_REDDIT, payload: reddit});
    }

    invalidateReddit(reddit : string){
        this.actions$.next({type: INVALIDATE_REDDIT, payload: {reddit} });
        this.selectReddit(reddit);
    }

    private shouldFetchPosts(postsByReddit, reddit){
        const posts = postsByReddit[reddit];
        if (!posts) {
            return true;
        }
        if (posts.isFetching) {
            return false;
        }
        return posts.didInvalidate;
    }
}