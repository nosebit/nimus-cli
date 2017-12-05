# Nimus

Nimus is like npm for clusters. Create and manage instances and deploys very easily with nimus. Let's make it happen! :)

## Instalation

To install nimus, just run:

```
sudo npm install -g nimus-cli
```

## Usage

Currently, nimus only support Google Cloud, but other providers are comming soon. To start with, create a credentials file following the next steps:

1. Access your google console at https://console.cloud.google.com;
2. Select *Api & Services* option in the left menu drawer;
3. Select *Credentials* option;
4. Click on *Create Credentials* button;
5. Select the *Service account key* type of credentials;
6. Select *Compute Engine default service account*;
7. Select *JSON* as key type;
8. Click on *Create* button and save the json file somewhere in your machine.

With your credentials json file dowloaded, let's create a nimus driver to google cloud using the credentials file:

```
nimus driver create --provider=gce --credentials=/path/to/credentials.json --name=my-google-driver
```

This driver dictates how nimus communicate with you google cloud account.

All computational resources in nimus are organized in projects, so let's create a project to hold our resources:

```
nimus project create --name=my-project
```

Finally, we can start create instances very easily with the command:

```
nimus instance create --name=my-instance --project=my-project --driver=my-google-driver
```

By default nimus create a `n1-standard-1` type of machine within `us-central1-a` zone (you can specify both with flags `--type` and `--zone`), attached to default network and assigns a public ip to each instance created. You can list all created instances with the command:

```
nimus instance list
```

If you wish to create similar instances at once you can do so passing a `--count` flag:

```
nimus instance create --name=db --project=my-project --driver=my-google-driver --type=n1-highmem-2 --count=3
```

This command will create the instances `db-1`, `db-2` and `db-3`. To remove these instances, just run:

```
nimus instance remove --name=db
```

To run a script against an instance, just do the following:

```
nimus instance run --project=my-project --name=my-instance /path/to/script
```

You can run single commands too:

```
nimus instance run --project=my-project --name=my-instance "echo hello world"
```

Soon we going to provide the first service packages to be deployed in your infra.