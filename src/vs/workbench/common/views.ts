/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TPromise } from 'vs/base/common/winjs.base';
import { Command } from 'vs/editor/common/modes';
import { UriComponents } from 'vs/base/common/uri';
import Event, { Emitter } from 'vs/base/common/event';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { ITreeViewDataProvider } from 'vs/workbench/common/views';
import { localize } from 'vs/nls';
import { IViewlet } from 'vs/workbench/common/viewlet';

export class ViewLocation {

	static readonly Explorer = new ViewLocation('explorer');
	static readonly Debug = new ViewLocation('debug');
	static readonly Extensions = new ViewLocation('extensions');

	constructor(private _id: string) {
	}

	get id(): string {
		return this._id;
	}

	static getContributedViewLocation(value: string): ViewLocation {
		switch (value) {
			case ViewLocation.Explorer.id: return ViewLocation.Explorer;
			case ViewLocation.Debug.id: return ViewLocation.Debug;
		}
		return void 0;
	}
}

export interface IViewDescriptor {

	readonly id: string;

	readonly name: string;

	readonly location: ViewLocation;

	// TODO do we really need this?!
	readonly ctor: any;

	readonly when?: ContextKeyExpr;

	readonly order?: number;

	readonly weight?: number;

	readonly collapsed?: boolean;

	readonly canToggleVisibility?: boolean;
}

export interface IViewsRegistry {

	readonly onViewsRegistered: Event<IViewDescriptor[]>;

	readonly onViewsDeregistered: Event<IViewDescriptor[]>;

	readonly onTreeViewDataProviderRegistered: Event<string>;

	registerViews(views: IViewDescriptor[]): void;

	deregisterViews(ids: string[], location: ViewLocation): void;

	registerTreeViewDataProvider(id: string, factory: ITreeViewDataProvider): void;

	deregisterTreeViewDataProviders(): void;

	getViews(loc: ViewLocation): IViewDescriptor[];

	getTreeViewDataProvider(id: string): ITreeViewDataProvider;

}

export const ViewsRegistry: IViewsRegistry = new class implements IViewsRegistry {

	private _onViewsRegistered: Emitter<IViewDescriptor[]> = new Emitter<IViewDescriptor[]>();
	readonly onViewsRegistered: Event<IViewDescriptor[]> = this._onViewsRegistered.event;

	private _onViewsDeregistered: Emitter<IViewDescriptor[]> = new Emitter<IViewDescriptor[]>();
	readonly onViewsDeregistered: Event<IViewDescriptor[]> = this._onViewsDeregistered.event;

	private _onTreeViewDataProviderRegistered: Emitter<string> = new Emitter<string>();
	readonly onTreeViewDataProviderRegistered: Event<string> = this._onTreeViewDataProviderRegistered.event;

	private _views: Map<ViewLocation, IViewDescriptor[]> = new Map<ViewLocation, IViewDescriptor[]>();
	private _treeViewDataPoviders: Map<string, ITreeViewDataProvider> = new Map<string, ITreeViewDataProvider>();

	registerViews(viewDescriptors: IViewDescriptor[]): void {
		if (viewDescriptors.length) {
			for (const viewDescriptor of viewDescriptors) {
				let views = this._views.get(viewDescriptor.location);
				if (!views) {
					views = [];
					this._views.set(viewDescriptor.location, views);
				}
				if (views.some(v => v.id === viewDescriptor.id)) {
					throw new Error(localize('duplicateId', "A view with id `{0}` is already registered in the location `{1}`", viewDescriptor.id, viewDescriptor.location.id));
				}
				views.push(viewDescriptor);
			}
			this._onViewsRegistered.fire(viewDescriptors);
		}
	}

	deregisterViews(ids: string[], location: ViewLocation): void {
		const views = this._views.get(location);

		if (!views) {
			return;
		}

		const viewsToDeregister = views.filter(view => ids.indexOf(view.id) !== -1);

		if (viewsToDeregister.length) {
			this._views.set(location, views.filter(view => ids.indexOf(view.id) === -1));
		}

		this._onViewsDeregistered.fire(viewsToDeregister);
	}

	registerTreeViewDataProvider(id: string, factory: ITreeViewDataProvider) {
		if (!this.isDataProviderRegistered(id)) {
			// TODO: throw error
		}
		this._treeViewDataPoviders.set(id, factory);
		this._onTreeViewDataProviderRegistered.fire(id);
	}

	deregisterTreeViewDataProviders(): void {
		this._treeViewDataPoviders.clear();
	}

	getViews(loc: ViewLocation): IViewDescriptor[] {
		return this._views.get(loc) || [];
	}

	getTreeViewDataProvider(id: string): ITreeViewDataProvider {
		return this._treeViewDataPoviders.get(id);
	}

	private isDataProviderRegistered(id: string): boolean {
		let registered = false;
		this._views.forEach(views => registered = registered || views.some(view => view.id === id));
		return registered;
	}
};

export interface IViewsViewlet extends IViewlet {

	openView(id: string): void;

}

// Custom view

export type TreeViewItemHandleArg = {
	$treeViewId: string,
	$treeItemHandle: string
};

export enum TreeItemCollapsibleState {
	None = 0,
	Collapsed = 1,
	Expanded = 2
}

export interface ITreeItem {

	handle: string;

	parentHandle: string;

	label?: string;

	icon?: string;

	iconDark?: string;

	resourceUri?: UriComponents;

	contextValue?: string;

	command?: Command;

	children?: ITreeItem[];

	collapsibleState?: TreeItemCollapsibleState;
}

export interface ITreeViewDataProvider {

	onDidChange: Event<ITreeItem[] | undefined | null>;

	onDispose: Event<void>;

	getElements(): TPromise<ITreeItem[]>;

	getChildren(element: ITreeItem): TPromise<ITreeItem[]>;
}